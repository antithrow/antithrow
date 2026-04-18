import type {
	NetworkInterfaceInfo,
	UserInfo,
	UserInfoOptions,
	UserInfoOptionsWithBufferEncoding,
	UserInfoOptionsWithStringEncoding,
} from "node:os";
import {
	getPriority as nodeGetPriority,
	homedir as nodeHomedir,
	hostname as nodeHostname,
	networkInterfaces as nodeNetworkInterfaces,
	setPriority as nodeSetPriority,
	uptime as nodeUptime,
	userInfo as nodeUserInfo,
} from "node:os";

import { Result } from "antithrow/legacy";

/**
 * A Node.js `SystemError` thrown when a system call fails.
 *
 * Unlike `NodeJS.ErrnoException` (used by `fs`), `SystemError` has `code` set
 * to `"ERR_SYSTEM_ERROR"` and carries an `info` object with the POSIX error
 * code, errno number, human-readable message, and syscall name.
 *
 * @see https://nodejs.org/api/errors.html#class-systemerror
 */
export interface SystemError extends Error {
	/** Always `"ERR_SYSTEM_ERROR"`. */
	code: "ERR_SYSTEM_ERROR";
	/** The libuv error number (negative). */
	errno: number;
	/** The name of the system call that triggered the error. */
	syscall: string;
	/** Extra details about the error condition. */
	info: {
		/** POSIX error code (e.g. `"ESRCH"`, `"EPERM"`). */
		code: string;
		/** The libuv error number (negative). */
		errno: number;
		/** Human-readable description of the error. */
		message: string;
		/** The system call that failed (e.g. `"uv_os_getpriority"`). */
		syscall: string;
	};
	/** If present, the file path when reporting a file system error. */
	path?: string | undefined;
	/** If present, the file path destination when reporting a file system error. */
	dest?: string | undefined;
	/** If present, the address to which a network connection failed. */
	address?: string | undefined;
	/** If present, the network connection port that is not available. */
	port?: number | undefined;
}

/**
 * Non-throwing wrapper around `os.homedir`.
 *
 * Returns the string path of the current user's home directory.
 *
 * @example
 * ```ts
 * import { homedir } from "@antithrow/node/os";
 *
 * const result = homedir();
 * // ok("/home/user") or err(SystemError)
 * ```
 *
 * @returns A `Result` containing the home directory path, or a `SystemError`.
 */
export function homedir(): Result<string, SystemError> {
	return Result.try(nodeHomedir);
}

/**
 * Non-throwing wrapper around `os.hostname`.
 *
 * Returns the host name of the operating system.
 *
 * @example
 * ```ts
 * import { hostname } from "@antithrow/node/os";
 *
 * const result = hostname();
 * // ok("my-machine") or err(SystemError)
 * ```
 *
 * @returns A `Result` containing the hostname, or a `SystemError`.
 */
export function hostname(): Result<string, SystemError> {
	return Result.try(nodeHostname);
}

/**
 * Non-throwing wrapper around `os.uptime`.
 *
 * Returns the system uptime in number of seconds.
 *
 * @example
 * ```ts
 * import { uptime } from "@antithrow/node/os";
 *
 * const result = uptime();
 * // ok(123456) or err(SystemError)
 * ```
 *
 * @returns A `Result` containing the uptime in seconds, or a `SystemError`.
 */
export function uptime(): Result<number, SystemError> {
	return Result.try(nodeUptime);
}

/**
 * Non-throwing wrapper around `os.networkInterfaces`.
 *
 * Returns an object containing network interfaces that have been assigned a network address.
 *
 * @example
 * ```ts
 * import { networkInterfaces } from "@antithrow/node/os";
 *
 * const result = networkInterfaces();
 * // ok({ lo: [...], eth0: [...] }) or err(SystemError)
 * ```
 *
 * @returns A `Result` containing a dictionary of network interfaces, or a `SystemError`.
 */
export function networkInterfaces(): Result<NodeJS.Dict<NetworkInterfaceInfo[]>, SystemError> {
	return Result.try(nodeNetworkInterfaces);
}

/**
 * Non-throwing wrapper around `os.userInfo`.
 *
 * Returns information about the currently effective user.
 * When `encoding` is `"buffer"`, string fields are returned as `Buffer` instances.
 *
 * @example
 * ```ts
 * import { userInfo } from "@antithrow/node/os";
 *
 * const result = userInfo();
 * // ok({ username: "user", uid: 1000, gid: 1000, shell: "/bin/bash", homedir: "/home/user" })
 * // or err(SystemError)
 * ```
 *
 * @param options - Optional encoding options.
 *
 * @returns A `Result` containing the user info, or a `SystemError`.
 */
export function userInfo(
	options?: UserInfoOptionsWithStringEncoding,
): Result<UserInfo<string>, SystemError>;
export function userInfo(
	options: UserInfoOptionsWithBufferEncoding,
): Result<UserInfo<Buffer>, SystemError>;
export function userInfo(options: UserInfoOptions): Result<UserInfo<string | Buffer>, SystemError>;
export function userInfo(
	options?: UserInfoOptions,
): Result<UserInfo<string | Buffer>, SystemError> {
	return Result.try(() => nodeUserInfo(options as UserInfoOptions));
}

/**
 * Non-throwing wrapper around `os.getPriority`.
 *
 * Returns the scheduling priority for the process specified by `pid`.
 *
 * @example
 * ```ts
 * import { getPriority } from "@antithrow/node/os";
 *
 * const result = getPriority();
 * // ok(0) or err(SystemError)
 * ```
 *
 * @param pid - The process ID to retrieve scheduling priority for. Defaults to `0` (current process).
 *
 * @returns A `Result` containing the priority value, or a `SystemError`.
 */
export function getPriority(pid?: number): Result<number, SystemError> {
	return Result.try(() => nodeGetPriority(pid));
}

/**
 * Non-throwing wrapper around `os.setPriority`.
 *
 * Sets the scheduling priority for the current process.
 *
 * @example
 * ```ts
 * import { setPriority } from "@antithrow/node/os";
 *
 * const result = setPriority(10);
 * // ok(undefined) or err(SystemError | RangeError)
 * ```
 *
 * @param priority - The scheduling priority to assign (between -20 and 19).
 *
 * @returns A `Result` containing `undefined` on success, or a `SystemError` / `RangeError`.
 */
export function setPriority(priority: number): Result<void, SystemError | RangeError>;
/**
 * Non-throwing wrapper around `os.setPriority`.
 *
 * Sets the scheduling priority for the process specified by `pid`.
 *
 * @example
 * ```ts
 * import { setPriority } from "@antithrow/node/os";
 *
 * const result = setPriority(process.pid, 10);
 * // ok(undefined) or err(SystemError | RangeError)
 * ```
 *
 * @param pid - The process ID to set scheduling priority for.
 * @param priority - The scheduling priority to assign (between -20 and 19).
 *
 * @returns A `Result` containing `undefined` on success, or a `SystemError` / `RangeError`.
 */
export function setPriority(pid: number, priority: number): Result<void, SystemError | RangeError>;
export function setPriority(
	pidOrPriority: number,
	priority?: number,
): Result<void, SystemError | RangeError> {
	return Result.try(() => {
		if (priority !== undefined) {
			nodeSetPriority(pidOrPriority, priority);
		} else {
			nodeSetPriority(pidOrPriority);
		}
	});
}
