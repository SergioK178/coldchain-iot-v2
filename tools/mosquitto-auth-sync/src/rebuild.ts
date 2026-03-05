import { writeFile, rename, chmod, chown } from 'node:fs/promises';
import path from 'node:path';

function buildPasswd(users: Array<{ username: string; passwordHash: string }>): string {
  return users.map((u) => `${u.username}:${u.passwordHash}`).join('\n') + '\n';
}

function buildAcl(adminUsername: string, devices: Array<{ username: string; serial: string }>): string {
  const lines: string[] = [];
  lines.push(`user ${adminUsername}`);
  lines.push('topic read d/+/t');
  lines.push('topic read d/+/s');
  lines.push('');
  for (const d of devices) {
    lines.push(`user ${d.username}`);
    lines.push(`topic write d/${d.serial}/t`);
    lines.push(`topic write d/${d.serial}/s`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

export async function writePasswdAcl(
  dataDir: string,
  adminUsername: string,
  adminPasswordHash: string,
  devices: Array<{ username: string; passwordHash: string; serial: string }>,
  fileOwner?: { uid: number; gid: number }
): Promise<void> {
  const users = [
    { username: adminUsername, passwordHash: adminPasswordHash },
    ...devices.map((d) => ({ username: d.username, passwordHash: d.passwordHash })),
  ];
  const aclEntries = devices.map((d) => ({ username: d.username, serial: d.serial }));

  const passwdPath = path.join(dataDir, 'passwd');
  const aclPath = path.join(dataDir, 'acl');
  const tmpPasswd = path.join(dataDir, `.passwd.tmp.${process.pid}`);
  const tmpAcl = path.join(dataDir, `.acl.tmp.${process.pid}`);

  await writeFile(tmpPasswd, buildPasswd(users), 'utf-8');
  await writeFile(tmpAcl, buildAcl(adminUsername, aclEntries), 'utf-8');
  await rename(tmpPasswd, passwdPath);
  await rename(tmpAcl, aclPath);
  await chmod(passwdPath, 0o700);
  await chmod(aclPath, 0o700);
  if (fileOwner) {
    await chown(passwdPath, fileOwner.uid, fileOwner.gid);
    await chown(aclPath, fileOwner.uid, fileOwner.gid);
  }
}
