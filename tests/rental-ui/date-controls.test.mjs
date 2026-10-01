import test from "node:test";
import assert from "node:assert/strict";
import { cyprusNow, validRentalDateTime } from "../../js/rental-date-values.js";
test("calendar uses Cyprus date across midnight and winter offsets", () => {
  assert.deepEqual(cyprusNow(new Date("2026-10-01T21:10:00Z")), {
    date: "2026-10-02",
    time: "00:10",
  });
  assert.deepEqual(cyprusNow(new Date("2026-12-01T21:10:00Z")), {
    date: "2026-12-01",
    time: "23:10",
  });
});
test("calendar accepts a future valid date/time and rejects malformed or past selections", () => {
  for (const time of ["09:59", "10:00", "24:00", "no"])
    assert.equal(
      validRentalDateTime("2026-10-01", time, "2026-10-01T10:00"),
      false,
    );
  assert.equal(
    validRentalDateTime("2026-10-01", "10:01", "2026-10-01T10:00"),
    true,
  );
  assert.equal(
    validRentalDateTime("2026-02-30", "10:00", "2026-02-01T10:00"),
    false,
  );
});
