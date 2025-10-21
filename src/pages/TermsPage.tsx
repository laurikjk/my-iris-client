import Header from "@/shared/components/header/Header"
import TermsContent from "@/shared/components/TermsContent"

export default function TermsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Terms of Service" slideUp={false} />
      <div className="flex-1 overflow-y-auto p-4 mx-4 md:p-8 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pt-4 md:pb-4">
        <div className="flex justify-center">
          <div className="flex-1 max-w-4xl">
            <div className="text-left text-sm text-neutral-300 bg-neutral-950 p-6 rounded">
              <TermsContent />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
