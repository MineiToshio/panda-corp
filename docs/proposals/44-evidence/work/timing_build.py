import collections as c
import json
from pathlib import Path

from timing import BEGIN, END, clipped, iso, read_rows, span, stats, ts, union

def phase(unit):
    return {'build':'implement','tests':'test authoring','docs':'docs',
            'review':'review','deferred-review':'review','patch':'repair'}.get(unit,'unknown')

def source(f, rows):
    return f'{f} rows={len(rows)} UTC={span(r.get("at",r.get("ts",r.get("t"))) for _,r in rows)}'

def builds(name, path, files):
    old={}; unique={}; result=[]
    for f in files:
        if f.name not in ('track.jsonl','build-journal.jsonl','journal.jsonl','perf-samples.jsonl'):
            continue
        rows=read_rows(f)
        if not rows:
            print('EMPTY',f);continue
        if f.name=='journal.jsonl':
            if not rows[0][1].get('run_id'):
                print('UNRECOGNIZED',source(f,rows));continue
            run_id=rows[0][1]['run_id']
            unique.setdefault(run_id,[]).append((f,rows))
        elif f.name=='perf-samples.jsonl':
            print('PERF SOURCE',source(f,rows),'sample keys',sorted(rows[0][1]))
        else:
            # Worktrees commonly carry inherited tracked histories. Merge exact rows.
            print('LEGACY SOURCE',source(f,rows))
            for n,r in rows:
                key=f.name,json.dumps(r,sort_keys=True)
                if key not in old or f==path/'.pandacorp'/f.name:
                    old[key]=f,n,r
    for run_id, sources in sorted(unique.items()):
        f,rows=max(sources,key=lambda x:len(x[1]))
        print('JOURNAL SOURCE',run_id,source(f,rows),
              'seq gaps/duplicates',len(rows)-(rows[-1][1]['seq']-rows[0][1]['seq']+1),
              'events',dict(c.Counter(r['type'] for _,r in rows)))
        for alt,rr in sources:
            if alt!=f:
                print('OTHER COPY',source(alt,rr),'rows shared',
                      len({json.dumps(r,sort_keys=True) for _,r in rr}&{json.dumps(r,sort_keys=True) for _,r in rows}))
        result.extend(build_run(name,f,rows))
    legacy(old,path)
    aggregate(result)
    return result

def build_run(project,f,rows):
    units={}; opened={}; dispatched={}; ordinals=c.Counter(); output=[]; summary=c.defaultdict(list)
    attempt_counts=c.Counter(); gate_results=c.Counter(); g2_inputs=c.Counter()
    for n,r in rows:
        d=r['data']; kind=r['type']; when=r['at']; time=ts(when)
        if time>END:
            continue
        unit=d.get('unit')
        if kind=='gate':
            gate_results[d.get('tier'),d.get('exit'),d.get('sha')]+=1
        if kind=='unit_queued':
            units[d['id']]=d
        elif kind=='unit_dispatched':
            ordinals[unit]+=1
            if unit in dispatched:
                print('DISPATCH no terminal report',f,dispatched[unit][0],unit)
            dispatched[unit]=(n,r)
            pk=units.get(unit,{}).get('kind')
            if pk=='patch':
                attempt_counts['patch dispatched']+=1
            if ordinals[unit]>1 and not d.get('resume'):
                attempt_counts['redispatch nonresume']+=1
                attempt_counts['redispatch nonresume '+phase(pk)]+=1
        elif kind=='report_received':
            prior=dispatched.pop(unit,None)
            if prior:
                start_n,start=prior
                a=ts(start['at']); detail=units.get(unit,{})
                print('DISPATCH->REPORT',f,f'{start_n},{n}',unit,phase(detail.get('kind')),
                      detail.get('wos'),d.get('outcome'),round(time-a,3))
                if start['data'].get('via')=='agent' and not start['data'].get('worker_id'):
                    work=(project,r['run_id'],phase(detail.get('kind')),a,time,'agent dispatch-to-report')
                    output.append(work); summary[unit].append(work)
        elif kind in ('patch','technical_failure','rescue_started','scope_repair_approved','engine_failure','unit_abandoned'):
            attempt_counts[kind]+=1
            print('RECOVERY',f,n,kind,unit,d.get('wos'),d.get('reason'),d.get('attempt'),d.get('cause'))
        elif kind=='job_started':
            opened[d['id']]=(n,r)
        elif kind=='job_finished':
            prior=opened.pop(d['id'],None)
            if not prior:
                print('JOB missing start',f,n,d['id']);continue
            start_n,start=prior
            row=start['data']; unit=row.get('unit'); detail=units.get(unit,{})
            a=ts(row.get('started_at') or start['at']); b=time
            job_kind=row.get('kind')
            category={'g2':'G2 gate job','land':'G3 land job'}.get(job_kind,phase(detail.get('kind')))
            evidence=f'{f}:{start_n},{n}'
            timing='journal start-to-harvest'
            cmd=f.parent/'jobs'/d['id']/'cmd.json'
            exitf=cmd.with_name('exit')
            if cmd.is_file() and exitf.is_file():
                meta=json.loads(cmd.read_text())
                file_end=exitf.stat().st_mtime
                if meta.get('job_id')==d['id'] and meta.get('started_at') and 0<=file_end-ts(meta['started_at']) and file_end<=time+1:
                    a=ts(meta['started_at'])
                    b=file_end
                    evidence+=f' {cmd}:started_at {exitf}:mtime'
                    timing='command start-to-exit mtime'
                    if job_kind=='g2':
                        g2_inputs[meta.get('cwd'),meta.get('cmd',[])[-1],int(exitf.read_text().strip())]+=1
            if b<a:
                print('JOB invalid duration',evidence,d['id'],a,b);continue
            work=(project,r['run_id'],category,a,b,timing)
            output.append(work)
            summary[unit or row.get('frd') or '(whole run)'].append(work)
            print('JOB',evidence,d['id'],unit,row.get('frd'),category,detail.get('wos'),
                  'elapsed_s',round(b-a,3),'journal harvest_s',round(time-a,3),
                  'exit',d.get('exit'),d.get('state'),timing)
    for j,(n,r) in opened.items():
        directory=f.parent/'jobs'/j
        cmd=directory/'cmd.json'
        exitf=directory/'exit'
        if r['data'].get('kind')=='g2' and cmd.is_file() and exitf.is_file():
            meta=json.loads(cmd.read_text())
            a=ts(meta['started_at'])
            b=exitf.stat().st_mtime
            code=int(exitf.read_text().strip())
            if meta['job_id']==j and a<=b<=END:
                work=(project,r['run_id'],'G2 gate job',a,b,'command start-to-exit mtime')
                output.append(work)
                summary[meta.get('frd') or '(whole run)'].append(work)
                g2_inputs[meta.get('cwd'),meta.get('cmd',[])[-1],code]+=1
                print('JOB FILE EXIT, no journal harvest',f,n,cmd,exitf,'elapsed_s',round(b-a,3),'exit',code)
                continue
        print('JOB open/missing finish',f,n,j)
    for u,(n,r) in dispatched.items():
        print('DISPATCH open/missing report',f,n,u)
    for unit,work in sorted(summary.items()):
        print('BUILD UNIT',unit,units.get(unit,{}).get('wos') or 'shared/unassigned',
              {category:stats(b-a for _,_,k,a,b,_ in work if k==category)
               for category in sorted({w[2] for w in work})})
    print('GATE RESULTS',dict(gate_results),'G2 COMMAND INPUTS grouped by cwd/base/exit',dict(g2_inputs))
    print('ATTEMPT COUNTS',dict(attempt_counts))
    return output

def legacy(old, path):
    for kind in ('track.jsonl','build-journal.jsonl'):
        rows=sorted((f,n,r) for (k,_),(f,n,r) in old.items() if k==kind)
        print('LEGACY DEDUP',kind,len(rows),span(r.get('at') for _,_,r in rows),
              'kind/rung/verdict',dict(c.Counter((r.get('kind'),r.get('rung'),r.get('verdict')) for _,_,r in rows)))
        main=path/'.pandacorp'/kind
        rows=[(f,n,r) for f,n,r in rows if f==main]
        opened={}; pairs=c.defaultdict(list)
        for f,n,r in rows:
            k=r.get('kind'); wo=r.get('wo'); frd=r.get('frd')
            if k in ('wo_start','review_start'):
                opened[k.split('_')[0],wo,frd]=(n,r['at'])
            elif k in ('wo_end','review_end','wo_done'):
                key=k.split('_')[0],wo,frd
                if key in opened:
                    start_n,a=opened.pop(key)
                    sec=ts(r['at'])-ts(a)
                    if sec>=0:
                        pairs[key[0]].append(sec)
                        print('LEGACY INTERVAL',f,f'{start_n},{n}',key,round(sec,3),r.get('verdict'))
            elif k=='attempt':
                print('LEGACY PATCH',f,n,wo,frd,r.get('rung'),r.get('attempt'),r.get('at'))
        if pairs:
            print('LEGACY MAIN phase intervals inclusive of pauses', {k:stats(v) for k,v in pairs.items()},
                  'unmatched starts',len(opened))

def aggregate(result):
    for category in sorted({x[2] for x in result}):
        rows=[(a,b,m) for _,_,k,a,b,m in result if k==category]
        print('BUILD AGG',category,stats(b-a for a,b,_ in rows),'timing type counts',
              dict(c.Counter(m for _,_,m in rows)),'30d summed h',
              round(sum(b-a for a,b in clipped([(a,b) for a,b,_ in rows]))/3600,4),
              '30d union h',round(union(clipped([(a,b) for a,b,_ in rows]))/3600,4))
    exact=clipped([(a,b) for _,_,k,a,b,m in result if k=='G2 gate job' and m=='command start-to-exit mtime'])
    print('BUILD G2 file-clock windows 30d',len(exact),'job-hours',round(sum(b-a for a,b in exact)/3600,4),
          'union h',round(union(exact)/3600,4))
