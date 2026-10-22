import Image from "next/image";
import { imgSrc } from "@/lib/images";
import {
  company,
  stats,
  services,
  allProjects,
  clients,
  timeline,
  trades,
  compliancePoints,
  registrations,
} from "@/lib/content";
import { Container, Photo, Section, SectionHeading } from "@/components/ui";
import Carousel from "@/components/Carousel";
import Plate from "@/components/Plate";
import Counter from "@/components/Counter";
import ProjectGrid from "@/components/ProjectGrid";
import { EnquiryForm, ApplicationForm } from "@/components/Forms";

export default function HomePage() {
  return (
    <>
      {/* ============================================================ HERO */}
      <section id="top" className="relative isolate flex min-h-screen items-center overflow-hidden">
        <Image
          src={imgSrc("hero-refinery-night")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="drift object-cover opacity-55"
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2">
          <div className="beam h-full w-full" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-void via-void/90 to-void/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/60" />
        <div className="grid-field absolute inset-0 opacity-60" />

        <Container className="relative z-10 pt-24">
          <div data-reveal>
            <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-accent">
              <span className="h-px w-10 bg-accent" />
              Since 2015
            </p>

            <h1 className="mt-8 max-w-4xl font-display text-[2.5rem] leading-[1.02] text-chalk sm:text-6xl lg:text-[4.25rem]">
              Plant operation, maintenance
              <br />
              and <span className="text-brand">skilled manpower.</span>
            </h1>

            <p className="mt-9 max-w-lg text-[15px] leading-relaxed text-mist">
              Serving refineries, smelters and process plants across Punjab,
              Rajasthan and Uttar Pradesh since 2015.
            </p>

            <div className="mt-12 flex flex-wrap gap-4">
              <a
                href="#projects"
                className="group relative inline-flex items-center gap-3 overflow-hidden bg-accent px-8 py-4 text-sm font-medium text-white"
              >
                <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
                <span className="relative z-10">Our work</span>
                <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1" aria-hidden>→</span>
              </a>
              <a
                href="#contact"
                className="group relative inline-flex items-center gap-3 overflow-hidden border border-line-strong px-8 py-4 text-sm font-medium text-chalk"
              >
                <span className="absolute inset-0 -translate-x-full bg-accent transition-transform duration-500 ease-out group-hover:translate-x-0" />
                <span className="relative z-10 transition-colors duration-300 group-hover:text-white">Contact us</span>
                <span className="relative z-10 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white" aria-hidden>→</span>
              </a>
            </div>
          </div>
        </Container>

        <div className="marquee absolute inset-x-0 bottom-0 z-10 overflow-hidden border-t border-line bg-void/80 py-4 backdrop-blur-sm">
          <div className="marquee-track flex w-max gap-14 whitespace-nowrap">
            {[...clients, ...clients].map((c, i) => (
              <span key={i} className="text-[11px] uppercase tracking-[0.24em] text-faint">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================== STATS */}
      <section className="relative border-y border-line">
        <Container>
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`group relative px-2 py-12 text-center transition-colors duration-500 hover:bg-deep ${
                  i % 2 === 0 ? "border-r border-line" : ""
                } ${i < 2 ? "border-b border-line lg:border-b-0" : ""} ${
                  i === 2 ? "lg:border-r lg:border-line" : ""
                }`}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}
              >
                <p className="font-display text-4xl text-chalk sm:text-5xl">
                  <Counter value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-faint transition-colors duration-500 group-hover:text-accent">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ============================================================ FIRM */}
      <Section className="py-20 sm:py-24">
        <div className="grid-field absolute inset-0 opacity-40" />
        <Container className="relative">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_240px]">
            <div>
              <SectionHeading eyebrow="About" title="The firm." />
              <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-mist">
                A proprietorship led by{" "}
                <strong className="font-medium text-chalk">{company.proprietor}</strong>,
                working out of Bathinda. We operate and maintain effluent,
                water-block and RO-DM plants, supply skilled manpower across
                thirty trades, and execute mechanical erection, pipeline and
                industrial painting work.
              </p>
            </div>
            <div data-reveal>
              <Plate tilt={false}>
                <Photo slug="engineer-inspecting" className="aspect-square" sizes="240px" />
              </Plate>
            </div>
          </div>
        </Container>
      </Section>

      {/* ======================================================== SERVICES */}
      <Section id="services" className="anchor">
        <div className="grid-field absolute inset-0 opacity-40" />
        <Container className="relative">
          <SectionHeading eyebrow="Capability" title="What we do." />

          <div className="mt-14">
            <Carousel label="Services">
            {services.map((s, i) => (
              <div key={s.slug} className="h-full">
                <Plate className="h-full">
                  <Photo slug={s.image} className="aspect-[16/10]" sizes="33vw" />
                  <div className="p-7">
                    <span className="font-display text-xs text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-3 font-display text-lg leading-snug text-chalk">
                      {s.title}
                    </h3>
                    <p className="mt-3 text-[13px] leading-relaxed text-mist">
                      {s.blurb}
                    </p>
                    <ul className="mt-5 space-y-1.5 border-t border-line pt-5">
                      {s.points.slice(0, 3).map((pt) => (
                        <li key={pt} className="flex gap-2.5 text-[12px] leading-relaxed text-faint">
                          <span className="mt-[7px] h-1 w-1 shrink-0 bg-accent" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Plate>
              </div>
            ))}
            </Carousel>
          </div>
        </Container>
      </Section>

      {/* ======================================================== PROJECTS */}
      <Section id="projects" className="anchor border-y border-line bg-deep">
        <Container>
          <SectionHeading
            eyebrow="Projects"
            title="Fourteen contracts."
            lead="Click any photograph for the full detail."
          />
          <div className="mt-14">
            <ProjectGrid projects={allProjects} />
          </div>
        </Container>
      </Section>

      {/* =========================================================== ABOUT */}
      <Section id="about" className="anchor">
        <div className="grid-field absolute inset-0 opacity-40" />
        <Container className="relative">
          <SectionHeading eyebrow="Track record" title="Year by year." />

          {/* Timeline */}
          <ol className="mt-14 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {timeline.map((t, i) => (
              <li
                key={t.year}
                className="group relative bg-surface p-6 transition-colors duration-500 hover:bg-raised"
                data-reveal
                style={{ ["--reveal-delay" as string]: `${(i % 4) * 60}ms` }}
              >
                <span className="absolute inset-x-0 top-0 h-px scale-x-0 bg-accent transition-transform duration-500 group-hover:scale-x-100" />
                <p className="font-display text-2xl text-brand">{t.year}</p>
                <p className="mt-2.5 text-[12px] leading-relaxed text-mist">{t.text}</p>
              </li>
            ))}
          </ol>

          {/* Trades */}
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(trades).map(([grade, list], i) => (
              <div
                key={grade}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${(i % 4) * 60}ms` }}
              >
                <Plate className="h-full p-5" tilt={false}>
                  <h3 className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent">
                    {grade}
                  </h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-mist">
                    {list.join(" · ")}
                  </p>
                </Plate>
              </div>
            ))}
          </div>

          {/* Compliance, folded into About rather than its own tab */}
          <div className="mt-20 border-t border-line pt-16">
            <SectionHeading
              eyebrow="Compliance"
              title="The paperwork is the product."
              lead="A client is not buying labour. They are buying the certainty that it is legal, insured, paid and documented."
            />

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {compliancePoints.slice(0, 4).map((c, i) => (
                <div
                  key={c.title}
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${(i % 4) * 60}ms` }}
                >
                  <Plate className="h-full p-6">
                    <p className="font-display text-xs text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h4 className="mt-3 font-display text-sm leading-snug text-chalk">
                      {c.title}
                    </h4>
                    <p className="mt-2.5 text-[12px] leading-relaxed text-mist">
                      {c.body}
                    </p>
                  </Plate>
                </div>
              ))}
            </div>

            <div className="mt-12 overflow-x-auto" data-reveal>
              <table className="w-full min-w-[560px] border-collapse text-left">
                <tbody>
                  {registrations.map((r) => (
                    <tr key={r.label} className="group border-b border-line transition-colors duration-300 hover:bg-deep">
                      <th scope="row" className="py-4 pr-8 align-top text-[12px] font-normal text-faint">
                        {r.label}
                      </th>
                      <td className="py-4 pr-8 align-top">
                        <span className="font-mono text-[14px] tracking-wide text-chalk transition-colors duration-300 group-hover:text-brand">
                          {r.value}
                        </span>
                      </td>
                      <td className="py-4 align-top text-[11px] text-mist">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </Section>

      {/* ========================================================= CAREERS */}
      <Section id="careers" className="anchor border-y border-line bg-deep">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
            <div>
              <SectionHeading
                eyebrow="Careers"
                title="Work at a refinery."
                lead="Helpers, fitters, operators, technicians, riggers, engineers and supervisors — employed directly by us."
              />
              <div className="mt-12 grid gap-5 sm:grid-cols-2">
                {[
                  { t: "Paid by the 7th", d: "Direct bank transfer. Never cash, never late because a client has not paid us." },
                  { t: "PF and ESI", d: "From your first month, with statutory bonus and insurance cover." },
                  { t: "A slip you can check", d: "A Form XIX wage slip every month, every line itemised." },
                  { t: "Safety first", d: "Full PPE, refinery safety training, same-day incident reporting." },
                ].map((x, i) => (
                  <div key={x.t} data-reveal style={{ ["--reveal-delay" as string]: `${(i % 2) * 70}ms` }}>
                    <Plate className="h-full p-6">
                      <h3 className="font-display text-[15px] text-chalk">{x.t}</h3>
                      <p className="mt-2.5 text-[12px] leading-relaxed text-mist">{x.d}</p>
                    </Plate>
                  </div>
                ))}
              </div>
            </div>

            <div data-reveal>
              <Plate className="p-8" tilt={false}>
                <h3 className="font-display text-xl text-chalk">Apply</h3>
                <p className="mt-2 text-[13px] text-mist">
                  We will call you when a suitable post opens.
                </p>
                <div className="mt-7">
                  <ApplicationForm />
                </div>
              </Plate>
            </div>
          </div>
        </Container>
      </Section>

      {/* ========================================================= CONTACT */}
      <Section id="contact" className="anchor">
        <div className="grid-field absolute inset-0 opacity-40" />
        <Container className="relative">
          <SectionHeading
            eyebrow="Contact"
            title="Tell us what you need."
            lead="Scope, site, duration."
          />
          <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_320px]">
            <div data-reveal>
              <EnquiryForm />
            </div>

            <aside className="space-y-9" data-reveal>
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                  Office
                </h3>
                <address className="mt-4 not-italic text-[13px] leading-relaxed text-mist">
                  <strong className="block font-medium text-chalk">
                    {company.tradeName}
                  </strong>
                  {company.addressLines.map((l) => (
                    <span key={l} className="block">{l}</span>
                  ))}
                </address>
              </div>
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                  Email
                </h3>
                <a href={`mailto:${company.email}`} className="link-underline mt-4 block break-all text-[13px] text-chalk">
                  {company.email}
                </a>
              </div>
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                  Phone
                </h3>
                <div className="mt-4 space-y-2">
                  {company.phones.map((p) => (
                    <a key={p} href={`tel:${p.replace(/\s/g, "")}`} className="link-underline block text-[13px] text-chalk">
                      {p}
                    </a>
                  ))}
                </div>
              </div>
              <div className="border-t border-line pt-7">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                  GSTIN
                </h3>
                <p className="mt-4 font-mono text-[13px] tracking-wide text-brand">
                  03ANIPS5337H1ZW
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
