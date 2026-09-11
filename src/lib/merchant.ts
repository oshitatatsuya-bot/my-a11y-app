/**
 * Public merchant disclosure for the Specified Commercial Transactions Act page.
 * Prefer email on the public page; disclose address/phone promptly on request
 * instead of publishing a home address.
 */
export const MERCHANT = {
  sellerName: "大下 達也",
  businessName: "A11yFix",
  role: "個人事業主",
  postalCode: "",
  address: "請求があり次第、遅滞なく開示いたします。",
  email: "support@geta11yfix.com",
  phone: "請求があり次第、遅滞なく開示いたします。",
  phoneNote: "お問い合わせはメールを優先してください。",
  siteUrl: "https://www.geta11yfix.com",
  priceNote:
    "Free プランは無料。Pro プランは月額 USD 29。Agency はウェイトリスト制で、契約前に範囲を確認します。表示価格の税込・税抜はチェックアウト時の表示に従います。",
  paymentNote: "クレジットカード決済（Stripe）。Pro は毎月自動更新されます。",
  deliveryNote:
    "決済完了後、ただちにオンラインでスキャン・AI 修正・履歴・バッジ機能をご利用いただけます。",
  cancelNote:
    "デジタルサービスの性質上、提供開始後の返金は原則として行いません。サブスクリプションはカスタマーポータルからいつでも解約でき、解約後は当期の終了まで利用できます。法令で返金が求められる場合はその限りではありません。",
  extraFees: "通信費はお客様負担です。その他の手数料はありません。",
} as const
