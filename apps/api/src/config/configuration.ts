export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/user_management',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  bcryptRounds: Math.max(12, parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10)),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change_me_access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change_me_refresh',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  superadmin: {
    username: process.env.SUPERADMIN_USERNAME ?? '',
    password: process.env.SUPERADMIN_PASSWORD ?? '',
    email: process.env.SUPERADMIN_EMAIL ?? 'superadmin@local.host',
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@local.host',
  },
  trading: {
    // push alert fires when a trade's net loss exceeds this ($); 0 disables
    lossAlertThreshold: parseFloat(process.env.TRADING_LOSS_ALERT_THRESHOLD ?? '100'),
  },
});
