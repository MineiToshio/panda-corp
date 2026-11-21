# Evidence for proposal 45

The original research files are preserved byte for byte. **Red team takes precedence** over the draft. The later independent verification corrects the installed-baseline, scheduler, timing and experiment details where specified. Source paths inside the originals still refer to the research workspace, original project checkouts and private local transcripts. This is an evidence archive. The scripts refer to those original paths and should be inspected before reuse.

## Reports

- [Anatomy](anatomy.md) maps execution, schemas, worker inputs, code history and the Funko launch rejection.
- [Failures](failures.md) preserves the run census, underlying interruption register, durations and recovery clocks.
- [Prompts](prompts.md) records benchmark arms, prompt construction, role conflicts and dated external sources.
- [Synthesis](synthesis.md) is the superseded first recommendation. Its phased comparison design is retained with the red-team corrections.
- [Red team](redteam.md) audits the census/benchmarks and specifies the corrected recommendation, contract, experiment and prompts.
- [Independent verification](verify-memo.md) reviews the original memo and owner summary against Git, installed plugin bytes, source and logs. Its line numbers and original verdict refer to the pre-correction deliverables.
- [Figures](figures.md) reconciles marks, corrections, derived shares and both deliverables’ numerical claims.

## Archived helpers and small outputs

- [anatomy_evidence.py](work/anatomy_evidence.py)
- [check_anatomy.py](work/check_anatomy.py)
- [implement_audit_candidates.txt](work/implement_audit_candidates.txt)
- [implement_audit_journal.py](work/implement_audit_journal.py)
- [implement_audit_journals.txt](work/implement_audit_journals.txt)
- [implement_audit_legacy_funko.txt](work/implement_audit_legacy_funko.txt)
- [implement_audit_legacy_mc.txt](work/implement_audit_legacy_mc.txt)
- [implement_audit_legacy_queue.txt](work/implement_audit_legacy_queue.txt)
- [implement_audit_metrics.py](work/implement_audit_metrics.py)
- [implement_audit_old.py](work/implement_audit_old.py)
- [implement_audit_oldfiles.txt](work/implement_audit_oldfiles.txt)
- [implement_audit_oldruns.txt](work/implement_audit_oldruns.txt)
- [implement_audit_scan.py](work/implement_audit_scan.py)
- [implement_audit_view.py](work/implement_audit_view.py)
- [implement_audit_workflows.py](work/implement_audit_workflows.py)
- [implement_audit_workflows.txt](work/implement_audit_workflows.txt)
- [verify_implement_audit.py](work/verify_implement_audit.py)
- [verify_redteam_implement.py](work/verify_redteam_implement.py)
- [verify_synthesis.py](work/verify_synthesis.py)

## Omitted by size

- `implement_audit_scan.json` is 2,452,183 bytes (**MEASURED**) and exceeds the requested archive limit. The lighter text outputs remain in this archive.
