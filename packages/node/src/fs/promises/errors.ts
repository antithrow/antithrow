/**
 * A Node.js filesystem error with a typed `code` property.
 *
 * This is structurally compatible with `NodeJS.ErrnoException` but narrows
 * the `code` field to a specific union of errno codes relevant to the
 * operation that produced it.
 */
export type FsError<Code extends string = string> = Omit<NodeJS.ErrnoException, "code"> & {
	code?: Code;
};
