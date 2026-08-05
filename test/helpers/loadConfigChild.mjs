// Run in a fresh child process (see config.test.js) so config.js's
// module-load-time validation — including its process.exit(1) on bad
// input — can be exercised safely without killing the test runner itself.
import { config } from "../../src/config.js";

// If we get here, loadConfig() succeeded. Print the parsed values so the
// parent test process can assert on the *coerced* types, not just on
// whether it succeeded.
process.stdout.write(JSON.stringify(config));
