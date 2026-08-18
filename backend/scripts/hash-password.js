import { hashPassword } from '../src/lib/crypto.js';
const password = process.argv[2] || 'Admin@123456';
console.log(await hashPassword(password));
