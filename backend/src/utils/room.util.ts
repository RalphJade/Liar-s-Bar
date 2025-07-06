import { faker } from "@faker-js/faker";

// Gera um código com 5 caracteres (letras e números)
export function generateCodeWithFaker(): string {
  return faker.string.alphanumeric(5).toUpperCase();
}

const code = generateCodeWithFaker();
console.log(code); // Ex: "A4d9z"
