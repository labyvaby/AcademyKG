// Feature: Employees API & helpers
import type { Employee } from "./types";
import { DB_TABLES } from "../../utility/constants";

// Legacy constants kept for compatibility with header/other components
export const EMPLOYEES_TABLE: string = DB_TABLES.EMPLOYEES;
export const EMPLOYEES_WRITE: string = DB_TABLES.EMPLOYEES;
export const EMPLOYEE_PHOTOS_BUCKET: string = "employees_photo";
export const EMPLOYEE_PASSPORTS_BUCKET: string = "employee_passports";
import {
  composePhone as composeFullPhone,
  parsePhone as parseFullPhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  type PhoneCountryCode,
} from "../../utility/phone";

// Helpers
export function getIdFrom(o: Record<string, unknown>): string {
  if (typeof o.id === 'string') return o.id;
  if (typeof o.ID === 'string') return o.ID;
  return ""; 
}

export function getNameFrom(o: Record<string, unknown>): string {
  if (typeof o.full_name === 'string') return o.full_name;
  if (typeof o.fullName === 'string') return o.fullName;
  if (typeof o.name === 'string') return o.name;
  return "";
}

export function getPhoneFrom(o: Record<string, unknown>): string | null {
  if (typeof o.phone === 'string') return o.phone;
  return null;
}

// Phone utils
export const PHONE_CC: string = DEFAULT_PHONE_COUNTRY_CODE;
const LOCAL_LEN = 9;
export function sanitizeKGLocal(input: string): string {
  return input.replace(/\D/g, "").slice(0, LOCAL_LEN);
}
export function isKGLocalValid(local: string): boolean {
  return local.length === LOCAL_LEN;
}
export function composeKGPhone(local: string): string | null {
  const l = sanitizeKGLocal(local.trim());
  return composeFullPhone(DEFAULT_PHONE_COUNTRY_CODE, l);
}
export function parseKGLocalFrom(input: string | null | undefined): string {
  const parsed = parseFullPhone(input ?? "");
  return sanitizeKGLocal(parsed.local);
}

export function composePhone(countryCode: PhoneCountryCode, local: string): string | null {
  return composeFullPhone(countryCode, local);
}

export function parsePhone(input: string | null | undefined): { countryCode: PhoneCountryCode; local: string } {
  return parseFullPhone(input ?? "");
}

// Map any object to Employee (simplified)
export function mapAnyToEmployee(o: Record<string, unknown>): Employee | null {
  const id = getIdFrom(o);
  if (!id) return null;
  const full_name = getNameFrom(o) || id;
  
  return { 
    id, 
    full_name, 
    phone: (typeof o.phone === 'string' ? o.phone : null) ?? (typeof o.userPhoneNumber === 'string' ? o.userPhoneNumber : null) ?? (typeof o.phoneNumber === 'string' ? o.phoneNumber : null),
    role_id: typeof o.role_id === 'string' ? o.role_id : (typeof o.role === 'string' ? o.role : (o.role && typeof (o.role as any).id === 'string' ? (o.role as any).id : null)),
    employee_type_id: typeof o.employee_type_id === 'string' ? o.employee_type_id : null,
    status: typeof o.status === 'string' ? o.status : null,
    birth_date: (typeof o.birth_date === 'string' ? o.birth_date : null) ?? (typeof o.birthDate === 'string' ? o.birthDate : null),
    photo_url: (typeof o.photo_url === 'string' ? o.photo_url : null) ?? (typeof o.photoUrl === 'string' ? o.photoUrl : null),
    telegram_id: (typeof o.telegram_id === 'string' ? o.telegram_id : null) ?? (typeof o.telegramId === 'string' ? o.telegramId : null),
    email: (typeof o.email === 'string' ? o.email : null) ?? (typeof o.userEmail === 'string' ? o.userEmail : null),
    bank_account_number: (typeof o.bank_account_number === 'string' ? o.bank_account_number : null) ?? (typeof o.bankAccountNumber === 'string' ? o.bankAccountNumber : null),
    nickname: typeof o.nickname === 'string' ? o.nickname : null,
    salary_rules: o.salary_rules || o.salaryRules || null,
    passport_photos: Array.isArray(o.passport_photos) ? o.passport_photos as string[]
      : Array.isArray((o as any).passportPhotos) ? (o as any).passportPhotos as string[]
      : null,
  } as Employee;
}

export function dedupeEmployees(arr: Employee[]): Employee[] {
  const seen = new Set<string>();
  const out: Employee[] = [];
  for (const e of arr) {
    if (!e.id || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}
