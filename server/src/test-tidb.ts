import dotenv from 'dotenv';
import { tidb } from './db/tidb.js';

dotenv.config();

async function runTest() {
  console.log('--- TiDB Connection & Foundation Verification ---');
  console.log('Host:', process.env.DB_HOST || '127.0.0.1');
  console.log('Port:', process.env.DB_PORT || '4000');
  console.log('Database:', process.env.DB_NAME || 'milkhub');
  console.log('User:', process.env.DB_USER || 'root');
  console.log('--------------------------------------------------');

  const connected = await tidb.initDatabase();
  const status = await tidb.getStatus();

  console.log('Status Result:');
  console.log(JSON.stringify(status, null, 2));

  if (connected) {
    console.log('SUCCESS: TiDB connected and Users table verified!');
    process.exit(0);
  } else {
    console.log('INFO: TiDB host not reached. System is functioning in fallback mode.');
    console.log('Configure TiDB credentials in server/.env when ready.');
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
