import json,collections
g=json.load(open('distinct.json'))
# idx: (class, stage)   classes: a,b,c,d,e,f,fm(f mid-work/transient),g,R(reviewer test red already counted in reviewer stream)
M={0:('f','vitest'),1:('d','vitest'),2:('f','playwright'),3:('f','playwright'),4:('f','playwright'),5:('f','playwright'),6:('f','playwright'),
7:('f','playwright'),8:('f','playwright'),9:('f','playwright'),10:('g','doc-lint/status-schema'),11:('g','vitest'),12:('g','vitest'),13:('fm','tsc'),
14:('fm','biome'),15:('fm','biome'),16:('f','playwright'),17:('fm','biome'),18:('fm','biome'),19:('f','playwright'),20:('fm','biome'),21:('fm','biome'),
22:('fm','biome'),23:('f','playwright'),24:('fm','biome'),25:('f','playwright'),26:('f','playwright'),27:('f','playwright'),28:('f','vitest'),
29:('f','tsc'),30:('f','tsc'),31:('f','playwright'),32:('fm','biome'),33:('d','vitest'),34:('d','vitest'),35:('fm','biome'),36:('fm','biome'),
37:('fm','biome'),38:('fm','biome'),39:('a','vitest'),40:('a','vitest'),41:('c','vitest'),42:('d','playwright'),43:('f','playwright'),44:('fm','vitest'),
45:('f','playwright'),46:('g','doc-lint'),47:('f','biome'),48:('fm','knip'),49:('g','vitest'),50:('d','vitest'),51:('d','vitest'),52:('d','vitest'),
53:('d','vitest'),54:('d','vitest'),55:('d','vitest'),56:('d','vitest'),57:('f','vitest'),58:('d','vitest'),59:('c','vitest'),60:('f','knip'),
61:('f','harness'),62:('d','vitest'),63:('d','vitest'),64:('c','playwright'),65:('d','vitest'),66:('c','playwright'),67:('f','biome'),68:('d','playwright'),
69:('d','playwright'),70:('d','playwright'),71:('d','playwright'),72:('d','vitest'),73:('d','vitest'),74:('f','tsc'),79:('d','vitest'),84:('d','playwright'),
91:('fm','vitest'),94:('f','tsc'),95:('f','vitest'),96:('fm','biome'),97:('f','vitest'),98:('fm','biome'),99:('c','vitest'),100:('c','vitest'),
101:('d','vitest'),102:('d','vitest'),103:('d','vitest'),104:('f','tsc'),105:('b','tsc'),106:('d','vitest'),107:('f','tsc'),108:('f','tsc'),109:('fm','biome'),
110:('R','vitest'),111:('f','biome'),112:('f','vitest'),113:('f','biome'),114:('d','vitest'),115:('f','harness'),116:('d','vitest'),117:('g','doc-lint'),
118:('fm','knip'),119:('fm','biome'),120:('b','knip'),121:('c','vitest'),122:('fm','vitest'),123:('fm','vitest'),124:('f','tsc'),125:('f','tsc'),
126:('g','vitest'),127:('fm','biome'),128:('fm','biome'),129:('c','vitest'),130:('f','playwright'),131:('f','playwright'),132:('f','vitest'),133:('f','build'),
134:('f','tsc'),135:('b','biome'),136:('b','biome'),137:('f','tsc'),138:('fm','knip'),139:('f','tsc'),140:('fm','biome'),141:('b','biome'),142:('f','vitest'),
143:('f','vitest'),144:('b','biome')}
for i in [75,76,77,78,80,81,82,83,85,86,87,88,89,90,92,93]: M[i]=('f','vitest')
assert len(M)==len(g),(len(M),len(g),[i for i in range(len(g)) if i not in M])
# merge duplicates of same root cause into episodes: same (proj,class,stage,root) where root given for known families
ROOT={**{i:'mc-port-3000-other-session' for i in (3,4,5,6)},**{i:'funko-hook-no-DATABASE_URL' for i in (75,76,77,78,80,81,82,83,85,86,87,88,89,90,92,93,97)},
      64:'mc-stale-tabs',66:'mc-stale-tabs',**{i:'mc-dmv-flaky' for i in (65,72,73,106)},**{i:'mc-ldm/nav-e2e-flaky' for i in (68,69,70,71,84)},
      **{i:'ppv2-parity-copy' for i in (11,12)},**{i:'ppv2-rebase' for i in (35,36,37,38)},**{i:'funko-load-timeouts-1019' for i in (50,51,52,54,55,58)},
      **{i:'funko-stale-prisma' for i in (94,104,107,124,125)},**{i:'ppv2-temp-scripts' for i in (17,20,21,22,24)},**{i:'ppv2-4010-collision' for i in (7,8,9,16,19,23,25,26,27)}}
eps={}
for i,(c,s) in M.items():
    k=ROOT.get(i,f'g{i}')
    e=eps.setdefault(k,dict(proj=g[i]['proj'],cls=c,stage=s,events=0,groups=0))
    e['events']+=g[i]['events']; e['groups']+=1
json.dump({'M':{str(k):v for k,v in M.items()},'eps':eps},open('stop_tally.json','w'))
print('signature groups',len(M),'episodes',len(eps),'events',sum(e['events'] for e in eps.values()))
for lvl in ['groups','episodes']:
    pass
c=collections.Counter((e['proj'],e['cls']) for e in eps.values())
print('by proj/class (episodes):'); 
for k,v in sorted(c.items()): print('  ',k,v)
print('by class (episodes):',collections.Counter(e['cls'] for e in eps.values()))
print('by class (events):',{k:sum(e['events'] for e in eps.values() if e['cls']==k) for k in set(e['cls'] for e in eps.values())})
st=collections.Counter((e['stage'],e['cls']) for e in eps.values())
for k,v in sorted(st.items()): print('  ',k,v)
