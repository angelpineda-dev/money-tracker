// Exhaustiveness check for `switch` over a union (e.g. TxType): if a new member is
// added (say, to a Prisma enum) and not handled, `tsc` fails at the call site.
export const assertNever = (value: never): never => {
    throw new Error(`Unhandled value: ${String(value)}`);
};
