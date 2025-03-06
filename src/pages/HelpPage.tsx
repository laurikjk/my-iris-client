import Header from "@/shared/components/header/Header"

export const AboutPage = () => {
  return (
    <section className="flex flex-col">
      <Header title="About" />
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
