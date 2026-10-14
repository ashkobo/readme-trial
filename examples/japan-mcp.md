# Trial: japan-mcp

Based on the library example in [japan-mcp](https://github.com/ashkobo/japan-mcp).
Assertions turn the documented results into checks.

Run from the readme-trial checkout:

```sh
node src/cli.js --package japan-mcp@0.1.1 --readme examples/japan-mcp.md
```

<!-- readme-trial: japanese-dates -->
```js
import assert from "node:assert/strict";
import { addBusinessDays, holidayName, fromWareki } from "japan-mcp";

assert.equal(addBusinessDays("2026-04-30", 3), "2026-05-08");
assert.equal(holidayName("2026-05-05"), "こどもの日");
assert.equal(fromWareki("平成31年4月30日").date, "2019-04-30");
console.log("Published japan-mcp examples passed.");
```
