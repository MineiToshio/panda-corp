// Reserve terminal maintenance against lease acquisition; active cleanup requires its own epoch.
import { withUnleasedProject } from '../../build-state.mjs';
import { readLeaseToken, readState } from '../state.mjs';

export async function withRunCleanup({ project, state, epoch = null }, mutation, deps = {}) {
  const check = async (lease = null) => {
    const current = await readState(project, deps);
    if (!current || !state || current.run_id !== state.run_id || current.epoch !== state.epoch ||
        (lease && (lease.run_id !== current.run_id || lease.epoch !== current.epoch))) {
      throw Object.assign(new Error('El run cambió antes de la limpieza.'), { code: 'CONTENDED' });
    }
    return mutation(current);
  };
  if (epoch !== null) {
    const bs = deps.buildState ?? await import('../../build-state.mjs');
    const token = await readLeaseToken(project, epoch, deps);
    return bs.withFence(project, token, Number(epoch), check);
  }
  return withUnleasedProject(project, check);
}
