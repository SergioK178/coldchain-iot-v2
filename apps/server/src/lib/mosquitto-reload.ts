import http from 'node:http';

/**
 * Send SIGHUP to a Docker container via Docker Engine API over unix socket.
 */
export function reloadMosquitto(opts: {
  socketPath: string;
  containerName: string;
}): Promise<void> {
  const { socketPath, containerName } = opts;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: `/containers/${containerName}/kill?signal=SIGHUP`,
        method: 'POST',
      },
      (res) => {
        if (res.statusCode === 204) {
          resolve();
        } else {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            reject(new Error(`Docker API returned ${res.statusCode}: ${body}`));
          });
        }
      },
    );
    req.on('error', reject);
    req.end();
  });
}
