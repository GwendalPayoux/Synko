import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const token = () => randomBytes(32).toString('hex');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password, stored) {
  const [salt, key] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, 'hex'));
}
export function text(value, label, max = 240) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new HttpError(422, `${label} est requis (maximum ${max} caractères).`);
  return value.trim();
}
export function email(value) {
  const result = text(value, 'Adresse e-mail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new HttpError(422, 'Adresse e-mail invalide.');
  return result;
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 256)
    throw new HttpError(422, 'Le mot de passe doit contenir entre 12 et 256 caractères.');
  return value;
}
export function date(value, label) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new HttpError(422, `${label} invalide.`);
  return value;
}
export function choice(value, values, label) {
  if (!values.includes(value)) throw new HttpError(422, `${label} invalide.`);
  return value;
}
export function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new HttpError(422, `${label} invalide.`);
  return value;
}
export const permissions = Object.freeze({
  org_admin: ['project:create', 'project:write', 'task:write', 'document:write', 'members:write'],
  project_manager: ['project:create', 'project:write', 'task:write', 'document:write'],
  pmo: [],
  contributor: ['task:assigned', 'document:write'],
  reader: [],
});
export function requirePermission(session, permission) {
  if (!permissions[session.role]?.includes(permission))
    throw new HttpError(403, 'Vous ne disposez pas des droits nécessaires.');
}
