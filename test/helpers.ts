import { generate } from "random-words";

export const createRandomWord = (): string => {
  const word: any = generate();
  return word;
};
