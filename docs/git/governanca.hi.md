# Git शासन नियम — DockDesk

🌐 [Português (BR)](governanca.pt.md) · [English](governanca.en.md) · [中文](governanca.zh.md) · **हिन्दी** · [Español](governanca.es.md) · [Français](governanca.fr.md)

एक ही प्रवाह है: **master ⬅ development**। नियम दो परतों में लागू होते हैं:

1. **लोकल हुक्स** (`.githooks/`) — `npm install` से अपने आप सक्रिय
   (`prepare` स्क्रिप्ट `core.hooksPath` सेट करती है);
2. **GitHub वर्कफ़्लो** (`.github/workflows/guard-*.yml`)।

अधिकृत उपयोगकर्ताओं की सूची
[`.github/authorized-users.json`](../../.github/authorized-users.json)
(फ़ील्ड: `github`, `name`, `email`) में है, दोनों परतें इसे साझा करती हैं।

## जो whitelist में NहीN हैं, उनके लिए नियम

- **`master` से ब्रांच नहीं बनाएँ** — अपनी ब्रांच `development` से बनाएँ;
- **लोकल `master` में बदलाव नहीं** (commit, merge, reset)। merge की एकमात्र
  अनुमत दिशा अपनी ब्रांच अपडेट करना है: `git checkout आपकी-ब्रांच && git merge master`;
- **`master` की ओर PR नहीं**, और `master` **से** PR भी नहीं (`development` की
  ओर भी नहीं) — उल्लंघन करने वाले PR अपने आप fail होकर बंद हो जाते हैं;
- **ब्रांच नाम**: `action/kebab-case-me-vivaran`
  (actions: `feature|add|mod|fix|del|rename|mov|refactor|style|docs|test|chore|perf`);
- **कमिट संदेश**: `**Action:** विवरण` (जैसे `**Add:** Open Modal`);
- **PR शीर्षक**: कमिट जैसा ही पैटर्न।

उदाहरणों और चेकलिस्ट के साथ पूर्ण मानक
[padroes-git-branch-commit-pr.md](../padroes-git-branch-commit-pr.md) (पुर्तगाली) में हैं।

## स्वचालित रिलीज़

हर `master` अपडेट पर रिलीज़ वर्कफ़्लो:

1. `package.json` से संस्करण पढ़ता है;
2. यदि यह मौजूदा सबसे बड़े tag के **बराबर या कम** है → पाइपलाइन **fail**;
3. यदि **अधिक** है → `vX.Y.Z` tag बनाता है, **AppImage** बिल्ड करता है और
   बाइनरी के साथ GitHub Release प्रकाशित करता है।

## लोकल परत के बारे में

Git हुक्स clone के साथ नहीं आते (git का अपना व्यवहार)। वे clone के पहले
`npm install` के बाद प्रभावी होते हैं — हर डेवलपर का सामान्य प्रवाह। जो कभी
dependencies इंस्टॉल नहीं करता, उसके पास लोकल गार्ड नहीं होंगे, लेकिन सर्वर
परतें (वर्कफ़्लो + ब्रांच सुरक्षा) उसे फिर भी रोकती हैं।
