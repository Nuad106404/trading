"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "th";

const STORAGE_KEY = "um_lang";

/** Flat dictionary — en is the source of truth, th the translation. */
const MESSAGES: Record<string, { en: string; th: string }> = {
  // navigation / chrome
  "nav.users": { en: "Users", th: "ผู้ใช้" },
  "nav.tradingOverview": { en: "Trading overview", th: "ภาพรวมเทรด" },
  "nav.trading": { en: "Trading", th: "เทรด" },
  "nav.dashboard": { en: "Dashboard", th: "แดชบอร์ด" },
  "nav.trades": { en: "Trades", th: "รายการเทรด" },
  "nav.cash": { en: "Cash", th: "ฝาก-ถอน" },
  "nav.import": { en: "Import", th: "นำเข้า" },
  "nav.profile": { en: "Profile", th: "โปรไฟล์" },
  "nav.logout": { en: "Logout", th: "ออกจากระบบ" },
  "nav.overview": { en: "Overview", th: "ภาพรวม" },
  "chrome.installApp": { en: "Install app", th: "ติดตั้งแอป" },
  "chrome.iosHint": {
    en: "Tap Share → Add to Home Screen to install",
    th: "แตะ แชร์ → เพิ่มไปยังหน้าจอโฮม เพื่อติดตั้ง",
  },
  "chrome.loading": { en: "Loading…", th: "กำลังโหลด…" },

  // common
  "common.actions": { en: "Actions", th: "จัดการ" },
  "common.edit": { en: "Edit", th: "แก้ไข" },
  "common.delete": { en: "Delete", th: "ลบ" },
  "common.deleting": { en: "Deleting…", th: "กำลังลบ…" },
  "common.cancel": { en: "Cancel", th: "ยกเลิก" },
  "common.close": { en: "Close", th: "ปิด" },
  "common.save": { en: "Save changes", th: "บันทึกการแก้ไข" },
  "common.saving": { en: "Saving…", th: "กำลังบันทึก…" },
  "common.add": { en: "Add", th: "เพิ่ม" },
  "common.search": { en: "Search", th: "ค้นหา" },
  "common.filter": { en: "Filter", th: "กรอง" },
  "common.previous": { en: "Previous", th: "ก่อนหน้า" },
  "common.next": { en: "Next", th: "ถัดไป" },
  "common.page": { en: "Page", th: "หน้า" },
  "common.of": { en: "of", th: "จาก" },
  "common.type": { en: "Type", th: "ประเภท" },
  "common.amount": { en: "Amount", th: "จำนวนเงิน" },
  "common.date": { en: "Date", th: "วันที่" },
  "common.note": { en: "Note", th: "หมายเหตุ" },
  "common.source": { en: "Source", th: "ที่มา" },
  "common.cannotUndo": { en: "this cannot be undone.", th: "ไม่สามารถย้อนกลับได้" },
  "common.offline": {
    en: "You're offline — reconnect to load data.",
    th: "คุณออฟไลน์อยู่ — เชื่อมต่ออินเทอร์เน็ตเพื่อโหลดข้อมูล",
  },
  "common.failedToLoad": { en: "Failed to load.", th: "โหลดข้อมูลไม่สำเร็จ" },

  // bulk operations
  "bulk.selected": { en: "selected", th: "รายการที่เลือก" },
  "bulk.clear": { en: "Clear", th: "ล้างที่เลือก" },
  "bulk.deleteTitle": { en: "Delete selected entries?", th: "ลบรายการที่เลือกทั้งหมด?" },
  "bulk.deleteDesc": {
    en: "The selected entries will be permanently removed — this cannot be undone.",
    th: "รายการที่เลือกจะถูกลบถาวร ไม่สามารถย้อนกลับได้",
  },

  // trading dashboard
  "trading.title1": { en: "Trading", th: "บันทึก" },
  "trading.title2": { en: "Journal", th: "การเทรด" },
  "trading.deposit": { en: "Deposit", th: "ฝากเงิน" },
  "trading.withdraw": { en: "Withdraw", th: "ถอนเงิน" },
  "trading.balance": { en: "Balance", th: "ยอดเงิน" },
  "trading.netPnl": { en: "Net P&L", th: "กำไรสุทธิ" },
  "trading.winrate": { en: "Winrate", th: "อัตราชนะ" },
  "trading.profitFactor": { en: "Profit factor", th: "Profit factor" },
  "trading.maxDrawdown": { en: "Max drawdown", th: "Drawdown สูงสุด" },
  "trading.trades": { en: "Trades", th: "จำนวนเทรด" },
  "trading.equityCurve": { en: "Equity curve", th: "กราฟเงินทุน (Equity)" },
  "trading.monthlyPnl": { en: "Monthly P&L", th: "กำไรรายเดือน" },
  "trading.bySymbol": { en: "By symbol", th: "แยกตามคู่เงิน" },
  "trading.statistics": { en: "Statistics", th: "สถิติ" },
  "trading.cashRecent": { en: "Cash flow (recent)", th: "กระแสเงินสด (ล่าสุด)" },
  "trading.noCurveData": {
    en: "No data yet — add trades or a deposit to see your curve.",
    th: "ยังไม่มีข้อมูล — เพิ่มเทรดหรือฝากเงินเพื่อดูกราฟ",
  },
  "trading.noClosedTrades": { en: "No closed trades yet.", th: "ยังไม่มีเทรดที่ปิดแล้ว" },
  "trading.noTrades": { en: "No trades yet.", th: "ยังไม่มีเทรด" },
  "trading.noCash": {
    en: "No deposits or withdrawals recorded yet.",
    th: "ยังไม่มีรายการฝากหรือถอน",
  },

  // stats labels
  "stats.totalTrades": { en: "Total trades", th: "เทรดทั้งหมด" },
  "stats.winsLosses": { en: "Wins / losses", th: "ชนะ / แพ้" },
  "stats.avgWin": { en: "Avg win", th: "กำไรเฉลี่ย" },
  "stats.avgLoss": { en: "Avg loss", th: "ขาดทุนเฉลี่ย" },
  "stats.rr": { en: "R:R", th: "R:R" },
  "stats.expectancy": { en: "Expectancy / trade", th: "ค่าคาดหวัง / เทรด" },
  "stats.maxWinStreak": { en: "Max win streak", th: "ชนะติดกันสูงสุด" },
  "stats.maxLossStreak": { en: "Max loss streak", th: "แพ้ติดกันสูงสุด" },
  "stats.largestWin": { en: "Largest win", th: "กำไรสูงสุด" },
  "stats.largestLoss": { en: "Largest loss", th: "ขาดทุนหนักสุด" },
  "stats.totalLots": { en: "Total lots", th: "Lots รวม" },
  "stats.commission": { en: "Commission", th: "ค่าคอมมิชชัน" },
  "stats.swap": { en: "Swap", th: "สวอป" },
  "stats.deposits": { en: "Deposits", th: "ยอดฝาก" },
  "stats.withdrawals": { en: "Withdrawals", th: "ยอดถอน" },

  // trades page
  "trades.title1": { en: "Trades", th: "รายการ" },
  "trades.title2": { en: "Log", th: "เทรด" },
  "trades.addTrade": { en: "Add trade", th: "เพิ่มเทรด" },
  "trades.searchPlaceholder": {
    en: "Search symbol, notes, tags…",
    th: "ค้นหา คู่เงิน โน้ต แท็ก…",
  },
  "trades.symbol": { en: "Symbol", th: "คู่เงิน" },
  "trades.side": { en: "Side", th: "ฝั่ง" },
  "trades.lots": { en: "Lots", th: "Lots" },
  "trades.netPnl": { en: "Net P&L", th: "กำไรสุทธิ" },
  "trades.closed": { en: "Closed", th: "ปิดเมื่อ" },
  "trades.prices": { en: "Prices", th: "ราคา" },
  "trades.tagsNotes": { en: "Tags / notes", th: "แท็ก / โน้ต" },
  "trades.allSides": { en: "All sides", th: "ทุกฝั่ง" },
  "trades.winAndLoss": { en: "Win & loss", th: "ชนะ & แพ้" },
  "trades.winsOnly": { en: "Wins only", th: "เฉพาะชนะ" },
  "trades.lossesOnly": { en: "Losses only", th: "เฉพาะแพ้" },
  "trades.loading": { en: "Loading trades…", th: "กำลังโหลดรายการเทรด…" },
  "trades.noMatch": {
    en: "No trades match these filters.",
    th: "ไม่พบเทรดตามตัวกรองนี้",
  },
  "trades.deleteTitle": { en: "Delete this trade?", th: "ลบเทรดนี้?" },
  "trades.editTitle": { en: "Edit trade", th: "แก้ไขเทรด" },
  "trades.count": { en: "trades", th: "เทรด" },

  // trade form
  "form.openPrice": { en: "Open price", th: "ราคาเปิด" },
  "form.closePrice": { en: "Close price", th: "ราคาปิด" },
  "form.openTime": { en: "Open time", th: "เวลาเปิด" },
  "form.closeTime": { en: "Close time", th: "เวลาปิด" },
  "form.profitAuto": { en: "Profit $ (blank = auto)", th: "กำไร $ (ว่าง = คำนวณให้)" },
  "form.tags": { en: "Tags (comma separated)", th: "แท็ก (คั่นด้วย , )" },
  "form.notes": { en: "Notes", th: "โน้ต" },
  "form.autoProfit": { en: "Auto profit:", th: "กำไรอัตโนมัติ:" },
  "form.grossFromPrices": { en: "(gross, from prices)", th: "(ก่อนหักค่าคอม คำนวณจากราคา)" },

  // cash page + quick dialog
  "cash.title1": { en: "Cash", th: "เงิน" },
  "cash.title2": { en: "Flow", th: "ฝาก-ถอน" },
  "cash.net": { en: "Net", th: "สุทธิ" },
  "cash.recordTitle": { en: "Record deposit / withdrawal", th: "บันทึกฝาก / ถอนเงิน" },
  "cash.amountUsd": { en: "Amount ($)", th: "จำนวนเงิน ($)" },
  "cash.deposit": { en: "deposit", th: "ฝาก" },
  "cash.withdrawal": { en: "withdrawal", th: "ถอน" },
  "cash.noTransactions": {
    en: "No transactions yet — record your first deposit above.",
    th: "ยังไม่มีธุรกรรม — บันทึกการฝากแรกด้านบน",
  },
  "cash.deleteTitle": { en: "Delete this transaction?", th: "ลบธุรกรรมนี้?" },
  "cash.depositTitle": { en: "Record a deposit", th: "บันทึกเงินฝาก" },
  "cash.withdrawTitle": { en: "Record a withdrawal", th: "บันทึกเงินถอน" },
  "cash.quickDesc": {
    en: "Saved to your journal immediately.",
    th: "บันทึกลงสมุดบันทึกของคุณทันที",
  },

  // import page
  "import.title1": { en: "Import", th: "นำเข้า" },
  "import.title2": { en: "MT5", th: "MT5" },
  "import.csvTemplate": { en: "CSV template", th: "เทมเพลต CSV" },
  "import.dropHere": {
    en: "Drop your MT5 file here (.xlsx report, .txt mobile journal, or .csv)",
    th: "วางไฟล์ MT5 ที่นี่ (รายงาน .xlsx, Journal มือถือ .txt หรือ .csv)",
  },
  "import.browse": { en: "or click to browse files", th: "หรือคลิกเพื่อเลือกไฟล์" },
  "import.preview": { en: "Preview", th: "ตัวอย่าง" },
  "import.trades": { en: "trades", th: "เทรด" },
  "import.cashTx": { en: "cash transactions", th: "ธุรกรรมเงิน" },
  "import.netToImport": { en: "net P&L to import", th: "กำไรสุทธิที่จะนำเข้า" },
  "import.confirm": { en: "Confirm import", th: "ยืนยันนำเข้า" },
  "import.importing": { en: "Importing…", th: "กำลังนำเข้า…" },
  "import.skipped": { en: "row(s) skipped:", th: "แถวถูกข้าม:" },
  "import.help.xlsxLabel": { en: "MT5 report (.xlsx):", th: "รายงาน MT5 (.xlsx):" },
  "import.help.xlsxBody": {
    en: "in MT5 open History, right-click → Report → Open XML (Excel). Closed positions are imported as trades; balance rows in the Deals section (deposits/withdrawals) become cash transactions.",
    th: "ใน MT5 เปิดหน้า History แล้วคลิกขวา → Report → Open XML (Excel) — ไม้ที่ปิดแล้วจะถูกนำเข้าเป็นเทรด ส่วนแถว balance ในหมวด Deals (ฝาก/ถอน) จะถูกบันทึกเป็นธุรกรรมเงินให้อัตโนมัติ",
  },
  "import.help.txtLabel": { en: "Mobile journal (.txt):", th: "Journal มือถือ (.txt):" },
  "import.help.txtBody": {
    en: "in the MT5 phone app open Journal → share/export the log. Positions opened and closed within the log become trades (profit derived from prices — the journal carries no P&L figures).",
    th: "ในแอป MT5 บนมือถือ เปิดหน้า Journal → แชร์/ส่งออกไฟล์ log — ไม้ที่เปิดและปิดภายใน log จะถูกนำเข้าเป็นเทรด (กำไรคำนวณจากราคา เพราะไฟล์ journal ไม่มีตัวเลขกำไร/ค่าคอม/สวอป)",
  },
  "import.help.csvLabel": { en: "CSV:", th: "CSV:" },
  "import.help.csvBody": {
    en: "columns matched case-insensitively (Symbol, Type, Volume, OpenPrice, ClosePrice, Commission, Swap, Profit, OpenTime, CloseTime, Comment) — see the template above.",
    th: "จับคู่หัวคอลัมน์โดยไม่สนตัวพิมพ์เล็ก-ใหญ่ (Symbol, Type, Volume, OpenPrice, ClosePrice, Commission, Swap, Profit, OpenTime, CloseTime, Comment) — ดาวน์โหลดเทมเพลตได้จากปุ่มด้านบน",
  },
  "import.help.dedup": {
    en: "Duplicates are detected automatically (broker ticket or identical symbol/side/lots/close-time) — re-uploading the same file never doubles your data.",
    th: "ระบบตรวจจับรายการซ้ำให้อัตโนมัติ (จากเลข ticket ของโบรกเกอร์ หรือรายการที่คู่เงิน/ฝั่ง/lots/เวลาปิดตรงกันทุกอย่าง) — อัปโหลดไฟล์เดิมซ้ำกี่ครั้ง ข้อมูลก็ไม่ถูกนับซ้ำ",
  },

  // profile
  "profile.title": { en: "Profile", th: "โปรไฟล์" },
  "profile.accountDetails": { en: "Your account details.", th: "ข้อมูลบัญชีของคุณ" },
  "profile.email": { en: "Email", th: "อีเมล" },
  "profile.fullName": { en: "Full name", th: "ชื่อ-นามสกุล" },
  "profile.role": { en: "Role", th: "บทบาท" },
  "profile.status": { en: "Status", th: "สถานะ" },
  "profile.lastLogin": { en: "Last login", th: "เข้าสู่ระบบล่าสุด" },
  "profile.memberSince": { en: "Member since", th: "เป็นสมาชิกตั้งแต่" },
  "profile.changePassword": { en: "Change password", th: "เปลี่ยนรหัสผ่าน" },
  "profile.currentPassword": { en: "Current password", th: "รหัสผ่านปัจจุบัน" },
  "profile.newPassword": { en: "New password", th: "รหัสผ่านใหม่" },
  "profile.confirmNewPassword": { en: "Confirm new password", th: "ยืนยันรหัสผ่านใหม่" },
  "profile.push": { en: "Push notifications", th: "การแจ้งเตือน (Push)" },
  "profile.pushDesc": {
    en: "Get notified about account and admin activity.",
    th: "รับการแจ้งเตือนกิจกรรมบัญชีและการเทรดของคุณ",
  },
  "profile.enablePush": { en: "Enable notifications", th: "เปิดการแจ้งเตือน" },
  "profile.disablePush": { en: "Disable notifications", th: "ปิดการแจ้งเตือน" },
  "profile.sendTest": { en: "Send test notification", th: "ส่งแจ้งเตือนทดสอบ" },

  // auth
  "auth.signIn": { en: "Sign in", th: "เข้าสู่ระบบ" },
  "auth.signInDesc": {
    en: "Enter your username or email to continue.",
    th: "กรอกชื่อผู้ใช้หรืออีเมลเพื่อเข้าใช้งาน",
  },
  "auth.usernameOrEmail": { en: "Username or email", th: "ชื่อผู้ใช้หรืออีเมล" },
  "auth.password": { en: "Password", th: "รหัสผ่าน" },
  "auth.signingIn": { en: "Signing in…", th: "กำลังเข้าสู่ระบบ…" },
  "auth.noAccount": { en: "No account?", th: "ยังไม่มีบัญชี?" },
  "auth.register": { en: "Register", th: "สมัครสมาชิก" },
  "auth.createAccount": { en: "Create an account", th: "สร้างบัญชี" },
  "auth.registerDesc": { en: "Register as a standard user.", th: "สมัครเป็นผู้ใช้ทั่วไป" },
  "auth.username": { en: "Username", th: "ชื่อผู้ใช้" },
  "auth.fullNameOptional": { en: "Full name (optional)", th: "ชื่อ-นามสกุล (ไม่บังคับ)" },
  "auth.confirmPassword": { en: "Confirm password", th: "ยืนยันรหัสผ่าน" },
  "auth.creating": { en: "Creating account…", th: "กำลังสร้างบัญชี…" },
  "auth.haveAccount": { en: "Already have an account?", th: "มีบัญชีอยู่แล้ว?" },

  // admin
  "admin.users.title": { en: "Users", th: "ผู้ใช้ทั้งหมด" },
  "admin.addUser": { en: "Add user", th: "เพิ่มผู้ใช้" },
  "admin.broadcast": { en: "Broadcast", th: "ประกาศ" },
  "admin.overview.title1": { en: "Trading", th: "ภาพรวม" },
  "admin.overview.title2": { en: "Overview", th: "การเทรด" },
  "admin.overview.badge": { en: "Oversight & management", th: "ดูแลและจัดการ" },
  "admin.overview.desc": {
    en: "Per-user journal aggregates. Select a user to inspect, edit or delete their entries — owners are notified of admin changes. Admin-role accounts can only manage user-role journals; superadmin can manage all.",
    th: "สรุปบันทึกเทรดรายผู้ใช้ เลือกผู้ใช้เพื่อดู แก้ไข หรือลบรายการ — เจ้าของจะได้รับแจ้งเตือนเมื่อแอดมินแก้ไข บัญชี admin จัดการได้เฉพาะบันทึกของ user ส่วน superadmin จัดการได้ทั้งหมด",
  },
  "admin.overview.user": { en: "User", th: "ผู้ใช้" },
  "admin.overview.lastTrade": { en: "Last trade", th: "เทรดล่าสุด" },
  "admin.overview.detail": { en: "Detail", th: "รายละเอียด" },
  "admin.overview.noActivity": {
    en: "No trading activity recorded by any user yet.",
    th: "ยังไม่มีผู้ใช้คนใดบันทึกการเทรด",
  },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // read persisted language after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "th" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: string): string => MESSAGES[key]?.[lang] ?? MESSAGES[key]?.en ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
