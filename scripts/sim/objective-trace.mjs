// Optional diagnostics only. No stdout and no extra objective evaluations.
import {appendFileSync, writeFileSync} from 'node:fs';
export function objectiveTrace(file) {
  if (!file) return undefined;
  writeFileSync(file, '', {flag: 'wx'}); // Do not overwrite earlier evidence.
  return event => appendFileSync(file, JSON.stringify(event) + '\n');
}
