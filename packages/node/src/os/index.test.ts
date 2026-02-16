import { describe, expect, test } from "bun:test";
import type { SystemError } from "./index.js";
import {
	getPriority,
	homedir,
	hostname,
	networkInterfaces,
	setPriority,
	uptime,
	userInfo,
} from "./index.js";

describe("homedir", () => {
	test("returns Ok with a string", () => {
		const result = homedir();

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("string");
		expect(result.unwrap().length).toBeGreaterThan(0);
	});
});

describe("hostname", () => {
	test("returns Ok with a string", () => {
		const result = hostname();

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("string");
		expect(result.unwrap().length).toBeGreaterThan(0);
	});
});

describe("uptime", () => {
	test("returns Ok with a number", () => {
		const result = uptime();

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("number");
		expect(result.unwrap()).toBeGreaterThan(0);
	});
});

describe("networkInterfaces", () => {
	test("returns Ok with a dictionary of interfaces", () => {
		const result = networkInterfaces();

		expect(result.isOk()).toBe(true);
		const interfaces = result.unwrap();
		expect(typeof interfaces).toBe("object");
		expect(interfaces).not.toBeNull();
	});
});

describe("userInfo", () => {
	test("returns Ok with user info object", () => {
		const result = userInfo();

		expect(result.isOk()).toBe(true);
		const info = result.unwrap();
		expect(typeof info.username).toBe("string");
		expect(typeof info.uid).toBe("number");
		expect(typeof info.gid).toBe("number");
		expect(typeof info.homedir).toBe("string");
	});
});

describe("getPriority", () => {
	test("returns Ok with a number for current process", () => {
		const result = getPriority();

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("number");
	});

	test("returns Ok with a number for specific pid", () => {
		const result = getPriority(process.pid);

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("number");
	});

	test("returns Err with SystemError for invalid pid", () => {
		const result = getPriority(-999999);

		expect(result.isErr()).toBe(true);
		const err = result.unwrapErr() as SystemError;
		expect(err.code).toBe("ERR_SYSTEM_ERROR");
		expect(err.syscall).toBe("uv_os_getpriority");
		expect(err.info.code).toBe("ESRCH");
	});
});

describe("setPriority", () => {
	test("returns Ok when setting priority for current process", () => {
		const result = setPriority(0);

		expect(result.isOk()).toBe(true);
	});

	test("returns Ok when setting priority for specific pid", () => {
		const result = setPriority(process.pid, 0);

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with SystemError for invalid pid", () => {
		const result = setPriority(-999999, 0);

		expect(result.isErr()).toBe(true);
		const err = result.unwrapErr() as SystemError;
		expect(err.code).toBe("ERR_SYSTEM_ERROR");
		expect(err.syscall).toBe("uv_os_getpriority");
	});

	test("returns Err with RangeError for out-of-range priority", () => {
		const result = setPriority(0, 999);

		expect(result.isErr()).toBe(true);
		const err = result.unwrapErr();
		expect(err).toBeInstanceOf(RangeError);
	});
});
