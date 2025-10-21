import Header from "@/shared/components/header/Header"

export default function TermsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Terms of Service" slideUp={false} />
      <div className="flex-1 overflow-y-auto p-4 mx-4 md:p-8 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pt-4 md:pb-4">
        <div className="flex justify-center">
          <div className="flex-1 max-w-4xl">
            <div className="prose max-w-prose">
              <h1>Terms of Service</h1>

              <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

              <p>
                <strong>IMPORTANT: PLEASE READ CAREFULLY. BY USING THIS APPLICATION, YOU AGREE TO THESE TERMS.</strong>
              </p>

              <h2>1. Software Provided "AS IS"</h2>
              <p>
                This software is provided "AS IS" without warranty of any kind, express or implied.
                We disclaim all warranties including merchantability, fitness for a particular purpose,
                and non-infringement. Use at your own risk.
              </p>

              <h2>2. No Liability for Damages</h2>
              <p>
                We are not liable for any direct, indirect, incidental, special, consequential, or
                punitive damages arising from your use of this application, including but not limited
                to data loss, service interruption, or any other damages.
              </p>

              <h2>3. Decentralized Social Network (Nostr)</h2>
              <p>
                This application connects to the Nostr protocol, a decentralized social network.
                We do not control the relays, content, or data you access. You are solely responsible
                for your interactions with third-party relays and content.
              </p>

              <h2>4. Cashu Wallet - We Are Not the Custodian</h2>
              <p>
                <strong>IMPORTANT: This application includes a Cashu ecash wallet.</strong>
              </p>
              <ul>
                <li>Cashu ecash is custodial - mints hold the actual Bitcoin</li>
                <li>We are NOT the custodian of your funds</li>
                <li>We do NOT operate a Cashu mint</li>
                <li>We do NOT hold, control, or have access to your ecash tokens</li>
                <li>All ecash tokens are managed entirely on your device</li>
              </ul>
              <p>
                You interact directly with third-party Cashu mints who act as custodians.
                We have no control over, responsibility for, or liability regarding any
                mint's operation, reliability, or solvency.
              </p>

              <h2>5. No Liability for Lost Funds</h2>
              <p>
                <strong>YOU ASSUME ALL RISKS OF FINANCIAL LOSS.</strong> We are not responsible
                for any loss of funds due to:
              </p>
              <ul>
                <li>Mint failures, insolvency, or fraud</li>
                <li>Device loss, damage, or theft</li>
                <li>User error or forgotten credentials</li>
                <li>Software bugs or vulnerabilities</li>
                <li>Network issues or relay failures</li>
                <li>Any other cause whatsoever</li>
              </ul>

              <h2>6. Experimental Technology</h2>
              <p>
                Cashu ecash is experimental technology. Ecash tokens are bearer assets - anyone
                with the token secret can spend them. You are solely responsible for securing
                your tokens and understanding the risks.
              </p>

              <h2>7. User Responsibility</h2>
              <p>You are solely responsible for:</p>
              <ul>
                <li>Backing up your data and keys</li>
                <li>Securing your device</li>
                <li>Verifying mint trustworthiness</li>
                <li>Compliance with applicable laws</li>
                <li>Understanding how Nostr and Cashu work</li>
              </ul>

              <h2>8. No Financial Services</h2>
              <p>
                This application does not provide financial, investment, or legal advice.
                We are not a financial institution, money transmitter, or payment processor.
              </p>

              <h2>9. Legal Compliance</h2>
              <p>
                You must comply with all applicable laws in your jurisdiction. Use is void
                where prohibited. We make no representations about legality in any jurisdiction.
              </p>

              <h2>10. Privacy</h2>
              <p>
                All data is stored locally on your device. We do not collect personal data.
                However, third-party services may log your activity:
              </p>
              <ul>
                <li>Nostr relays may log connections and events</li>
                <li>Cashu mints may log connections and transactions</li>
                <li>File hosting services (for images/media uploads) may log uploads and IPs</li>
              </ul>

              <h2>11. Modifications</h2>
              <p>
                We may modify these terms at any time. Continued use constitutes acceptance.
              </p>

              <h2>12. Acceptance</h2>
              <p>
                By using this application, you acknowledge that you have read, understood,
                and agree to these terms.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
