import json,re
def commands(e):
 if e.get('name')=='Bash':return [e['text']]
 if e.get('name') in ('exec_command','shell_command'):
  try:return [json.loads(e['text']).get('cmd','')]
  except:return []
 if e.get('name')=='exec':
  return [json.loads(m.group(1)) for m in re.finditer(r'cmd\s*:\s*("(?:[^"\\]|\\.)*")',e['text'])]
 return []
def actual(s):
 # Executable token, with optional bash/env. Avoid reads and synthetic code/fixtures.
 if '<<' in s:return False
 return bool(re.search(r'(?:^|[;&|]\s*|\n|&&\s*|\s(?:bash|sh|env)\s+)(?:(?:[A-Z_]+=[^\s]+|bash|sh|env|/usr/bin/time|-p)\s+)*(?:[./$\w{}-]+/)?merge-queue\.sh(?:\s|$)',s)) and '--help' not in s
