/**
 * Public merchant disclosure for the Specified Commercial Transactions Act page.
 * Keep this aligned with what you file with Stripe / tax authorities.
 */
export const MERCHANT = {
  sellerName: "大下 達也",
  businessName: "A11yFix",
  role: "個人事業主",
  postalCode: "〒252-0003",
  address: "神奈川県座間市ひばりが丘四丁目5番5号 アルエットハイム302",
  email: "support@geta11yfix.com",
  phone: "+81 70-9143-1914",
  phoneNote: "メールでのお問い合わせを優先します。電話は必要に応じてご案内します。",
  siteUrl: "https://www.geta11yfix.com",
  priceNote:
    "Free プランは無料。Pro プランは月額 USD 29。Agency はウェイトリスト制で、契約前に範囲を確認します。表示価格は税込表記を別途明示するまで税抜の目安です。",
  paymentNote: "クレジットカード決済（Stripe）。Pro は毎月自動更新されます。",
  deliveryNote:
    "決済完了後、ただちにオンラインでスキャン・AI 修正・履歴・バッジ機能をご利用いただけます。",
  cancelNote:
    "デジタルサービスの性質上、提供開始後の返金は原則として行いません。サブスクリプションはカスタマーポータルからいつでも解約でき、解約後は当期の終了まで利用できます。法令で返金が求められる場合はその限りではありません。",
  extraFees: "通信費はお客様負担です。その他の手数料はありません。",
} as const
