import { spawn } from 'node:child_process';

const vitePort = process.env.VITE_PORT || '8080';
const socketPort = process.env.SOCKET_PORT || '3000';

const services = [
  {
    name: 'socket',
    command: 'node',
    args: ['server.js'],
    env: {
      SOCKET_PORT: socketPort,
      SOCKET_HOST: process.env.SOCKET_HOST || '0.0.0.0',
    },
  },
  {
    name: 'vite',
    command: 'npm',
    args: ['run', 'dev', '--', '--host', '0.0.0.0', '--port', vitePort],
  },
];

const children = [];
let shuttingDown = false;

function stopChildren(signal = 'SIGTERM') {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopChildren(signal);
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    env: {
      ...process.env,
      ...service.env,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${service.name}] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[${service.name}] ${data}`);
  });

  child.on('error', (error) => {
    if (!shuttingDown) {
      shuttingDown = true;
      console.error(`[${service.name}] ${error.message}`);
      stopChildren();
      process.exit(1);
    }
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`[${service.name}] exited with ${signal || `code ${code}`}`);
    stopChildren();
    process.exit(code ?? 1);
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
