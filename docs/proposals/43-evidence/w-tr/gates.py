import shlex,re
def gates(s):
 if '<<' in s:return []
 try:
  lexer=shlex.shlex(s,posix=True,punctuation_chars=';&|\n');lexer.whitespace_split=True;ts=list(lexer)
 except ValueError:return []
 segments=[];buf=[]
 for t in ts+[';']:
  if all(c in ';&|\n' for c in t):
   if buf:segments.append(buf);buf=[]
  else:buf.append(t)
 out=[]
 for seq in segments:
  for i,t in enumerate(seq):
   base=t.rsplit('/',1)[-1];args=seq[i+1:]
   if base in ('bash','sh') and args and args[0].endswith('verify.sh'):
    flags=[a for a in args[1:] if a.startswith('--')]
    mode='verify completo' if not flags else 'verify parcial '+','.join(flags)
    out.append((mode,shlex.join(seq[i:])))
   elif base in ('pnpm','npm','npx','yarn','bun'):
    if any(x in ('vitest','playwright','test') or x.startswith('test:') for x in args[:4]):
     mode='tests sueltos (Playwright)' if 'playwright' in args[:4] else 'tests sueltos (Vitest)' if 'vitest' in args[:4] else 'tests sueltos'
     out.append((mode,shlex.join(seq[i:])))
   elif base=='node' and '--test' in args[:2]:out.append(('tests sueltos (node)',shlex.join(seq[i:])))
 return out
