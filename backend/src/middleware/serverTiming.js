
let coldFlag = true;

function serverTiming(req, res, next) {
  const start = process.hrtime.bigint();
  const isColdStart = coldFlag;
  coldFlag = false;

  // Attach timing before the response headers are sent.
  const originalWriteHead = res.writeHead;

  res.writeHead = function (...args) {
    if (!res.headersSent) {
      const durationMs =
        Number(process.hrtime.bigint() - start) / 1_000_000;

      res.setHeader(
        'Server-Timing',
        `app;dur=${durationMs.toFixed(1)}, cold;desc="${isColdStart}"`
      );
    }

    return originalWriteHead.apply(this, args);
  };

  // Also cover responses that use res.end() without writeHead().
  const originalEnd = res.end;

  res.end = function (...args) {
    if (!res.headersSent) {
      const durationMs =
        Number(process.hrtime.bigint() - start) / 1_000_000;

      res.setHeader(
        'Server-Timing',
        `app;dur=${durationMs.toFixed(1)}, cold;desc="${isColdStart}"`
      );
    }

    return originalEnd.apply(this, args);
  };

  next();
}

module.exports = serverTiming;
