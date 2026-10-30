/** Every application route retains the global navigation shell. */
export function isShellExempt(_pathname: string): boolean {
  return false;
}
