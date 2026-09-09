import fs from 'node:fs/promises';
import path from 'node:path';

const LOCALES_DIR = path.resolve('src/i18n/locales');

const newKeys = {
  en: {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "Globally control sidebar sections and modules display, drag handles or use arrows to reorder",
    "Drag to reorder section": "Drag to reorder section",
    "Drag to reorder module": "Drag to reorder module",
    "Move section up": "Move section up",
    "Move section down": "Move section down",
    "Move up": "Move up",
    "Move down": "Move down",
    "Reset to default configuration": "Reset to default configuration",
  },
  "zh-CN": {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "全局控制侧边栏区域与功能显示，支持拖拽手柄或箭头调整展示顺序",
    "Drag to reorder section": "按住拖动调整区域顺序",
    "Drag to reorder module": "按住拖动调整功能顺序",
    "Move section up": "上移区域",
    "Move section down": "下移区域",
    "Move up": "上移",
    "Move down": "下移",
    "Reset to default configuration": "重置为默认配置",
  },
  zh: {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "全局控制侧边栏区域与功能显示，支持拖拽手柄或箭头调整展示顺序",
    "Drag to reorder section": "按住拖动调整区域顺序",
    "Drag to reorder module": "按住拖动调整功能顺序",
    "Move section up": "上移区域",
    "Move section down": "下移区域",
    "Move up": "上移",
    "Move down": "下移",
    "Reset to default configuration": "重置为默认配置",
  },
  "zh-TW": {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "全域控制側邊欄區域與功能顯示，支援拖曳控制代碼或箭頭調整顯示順序",
    "Drag to reorder section": "按住拖曳調整區域順序",
    "Drag to reorder module": "按住拖曳調整功能順序",
    "Move section up": "上移區域",
    "Move section down": "下移區域",
    "Move up": "上移",
    "Move down": "下移",
    "Reset to default configuration": "重設為預設設定",
  },
  fr: {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "Contrôle global des sections et modules de la barre latérale, faites glisser les poignées ou utilisez les flèches pour réorganiser",
    "Drag to reorder section": "Faites glisser pour réorganiser la section",
    "Drag to reorder module": "Faites glisser pour réorganiser le module",
    "Move section up": "Monter la section",
    "Move section down": "Descendre la section",
    "Move up": "Monter",
    "Move down": "Descendre",
    "Reset to default configuration": "Rétablir la configuration par défaut",
  },
  ja: {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "サイドバーのセクションとモジュールのグローバル制御。ハンドルをドラッグするか矢印で順序を変更できます",
    "Drag to reorder section": "ドラッグしてセクションの順序を変更",
    "Drag to reorder module": "ドラッグしてモジュールの順序を変更",
    "Move section up": "セクションを上へ",
    "Move section down": "セクションを下へ",
    "Move up": "上へ",
    "Move down": "下へ",
    "Reset to default configuration": "デフォルト設定に戻す",
  },
  ru: {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "Глобальное управление разделами и модулями боковой панели, перетаскивайте за ручки или используйте стрелки для изменения порядка",
    "Drag to reorder section": "Перетащите для изменения порядка раздела",
    "Drag to reorder module": "Перетащите для изменения порядка модуля",
    "Move section up": "Переместить раздел вверх",
    "Move section down": "Переместить раздел вниз",
    "Move up": "Вверх",
    "Move down": "Вниз",
    "Reset to default configuration": "Сбросить к настройкам по умолчанию",
  },
  vi: {
    "Globally control sidebar sections and modules display, drag handles or use arrows to reorder": "Kiểm soát toàn cục các phần và mô-đun của thanh bên, kéo các chốt hoặc dùng mũi tên để sắp xếp lại",
    "Drag to reorder section": "Kéo để sắp xếp lại phần",
    "Drag to reorder module": "Kéo để sắp xếp lại mô-đun",
    "Move section up": "Di chuyển phần lên",
    "Move section down": "Di chuyển phần xuống",
    "Move up": "Lên",
    "Move down": "Xuống",
    "Reset to default configuration": "Đặt lại về cấu hình mặc định",
  },
};

for (const [locale, trans] of Object.entries(newKeys)) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  const json = JSON.parse(await fs.readFile(filePath, 'utf8'));
  Object.assign(json.translation, trans);
  json.translation = Object.fromEntries(
    Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
  );
  await fs.writeFile(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${locale}: ${Object.keys(trans).length} translations applied`);
}
