const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';

const services = [
  {
    name: 'react',
    command: 'npm',
    args: ['run', 'start'],
    env: { BROWSER: 'none' },
  },
  {
    name: 'trippy',
    command: 'npm',
    args: ['run', 'chatbot-backend'],
  },
  {
    name: 'serpapi',
    command: 'npm',
    args: ['run', 'serpapi-proxy'],
  },
];

const children = [];
let shuttingDown = false;

function log(name, data, stream = process.stdout) {
  data
    .toString()
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => stream.write(`[${name}] ${line}\n`));
}

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  children.forEach((child) => {
    if (!child.killed) {
      child.kill(isWindows ? undefined : 'SIGTERM');
    }
  });

  setTimeout(() => process.exit(exitCode), 300);
}

services.forEach((service) => {
  const command = isWindows ? 'cmd.exe' : service.command;
  const args = isWindows
    ? ['/d', '/s', '/c', [service.command, ...service.args].join(' ')]
    : service.args;
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...(service.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  children.push(child);
  child.stdout.on('data', (data) => log(service.name, data));
  child.stderr.on('data', (data) => log(service.name, data, process.stderr));

  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      process.stderr.write(`[dev] ${service.name} exited with code ${code}\n`);
      stopAll(code || 1);
    }
  });
});

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

console.log('Starting TripAI dev services: React, Trippy backend, and SerpApi proxy.');
console.log('React: http://localhost:3000');
console.log('Trippy backend: http://localhost:5000');
console.log('SerpApi proxy: http://localhost:5051');
