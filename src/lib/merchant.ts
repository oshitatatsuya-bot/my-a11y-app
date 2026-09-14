/**
 * Public merchant disclosure for the Specified Commercial Transactions Act page.
 * Keep PII minimal on the public page: first name only; disclose full name,
 * address, and phone promptly on request. Prefer email for contact.
 */
export const MERCHANT = {
  sellerName: "達也",
  businessName: "A11yFix",
  role: "個人事業主",
  postalCode: "",
  address: "請求があり次第、遅滞なく開示いたします。",
  email: "support@geta11yfix.com",
  phone: "請求があり次第、遅滞なく開示いたします。",
  phoneNote: "お問い合わせはメールを優先してください。",
  nameNote: "氏名の詳細は請求があり次第、遅滞なく開示いたします。",
  siteUrl: "https://www.geta11yfix.com",
  priceNote:
    "Free プランは無料（3 サイト・月 15 ページスキャン、sitemap サイトスキャン最大 5 ページ。example.com はサイト枠外）。Pro プランは月額 USD 29（サイトスキャン最大 25 ページ）。Agency はウェイトリスト制で、契約前に範囲を確認します。表示価格の税込・税抜はチェックアウト時の表示に従います。",
  paymentNote: "クレジットカード決済（Stripe）。Pro は毎月自動更新されます。",
  deliveryNote:
    "決済完了後、ただちにオンラインでスキャン・AI 修正・履歴・バッジ機能をご利用いただけます。",
  cancelNote:
    "デジタルサービスの性質上、提供開始後の返金は原則として行いません。サブスクリプションはカスタマーポータルからいつでも解約でき、解約後は当期の終了まで利用できます。法令で返金が求められる場合はその限りではありません。",
  extraFees: "通信費はお客様負担です。その他の手数料はありません。",
} as const
