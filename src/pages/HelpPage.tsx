import MiddleHeader from "@/shared/components/header/MiddleHeader"

export const AboutPage = () => {
  return (
    <section className="flex flex-col">
      <MiddleHeader title="About" />
      <div className="flex flex-1 mx-4 my-4 lg:mx-8">
        <div className="prose max-w-prose">
          <h1>About</h1>
          <p>{CONFIG.aboutText}</p>
          <p>
            <a href={CONFIG.repository}>Source code</a>
          </p>
        </div>
      </div>
    </section>
  )
}
