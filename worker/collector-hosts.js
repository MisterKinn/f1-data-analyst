// Home collector hosts (computers on a home connection that F1 does not block).
// Each host signs its uploads with its own Ed25519 private key; only the public key
// lives here. To add a host, run `python collector/host_auth.py keygen --name <name>`
// on that computer and add the printed line below. To retire a host, delete its line.
// Public keys are not secrets, so this file is safe in a public repository.
export const COLLECTOR_HOSTS=[
 {name:'desktop-568ditg',key:'X0nVoYozkWCoAvQnmd_pfQEIAxhXMxTm0foQn0AI8TY'}, // Jeongmin's HP PC (primary until a mini PC arrives)
];
