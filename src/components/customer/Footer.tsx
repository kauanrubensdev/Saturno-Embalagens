import { Link } from '@tanstack/react-router';

export function Footer() {
  const whatsappUrl =
    'https://wa.me/5531994838720?text=Ol%C3%A1!%20Gostaria%20de%20fazer%20uma%20arte%20personalizada%20para%20minhas%20embalagens.';

  return (
    <footer style={{ backgroundColor: 'var(--card)', borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 py-14 md:py-16">
        {/* Main Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-5 no-underline group">
              <img
                src="/favicon.png"
                alt="Saturno Embalagens"
                className="w-10 h-10 object-contain transition-transform group-hover:scale-105"
              />
              <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                SaturnoEmbalagens
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Embalagens de qualidade para delivery. Qualidade e preço justo para seu negócio.
            </p>
            {/* Accent line */}
            <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
          </div>

          {/* Navigation Column */}
          <div>
            <h3
              className="font-semibold text-sm mb-5 flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
              Navegação
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/"
                  className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <span
                    className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                  <span className="group-hover:opacity-80">Início</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/catalog"
                  className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <span
                    className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                  <span className="group-hover:opacity-80">Catálogo</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/cart"
                  className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <span
                    className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                  <span className="group-hover:opacity-80">Carrinho</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <span
                    className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                  <span className="group-hover:opacity-80">Minha conta</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h3
              className="font-semibold text-sm mb-5 flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
              Contato
            </h3>
            <ul className="space-y-3.5">
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm no-underline transition-colors inline-flex items-center gap-2 group"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label="Fale conosco pelo WhatsApp (31) 99483-8720"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      style={{ color: '#25D366' }}
                    >
                      <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.275-.1-.476-.15-.676.15-.2.301-.777.978-.952 1.179-.176.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.799-1.5-1.786-1.676-2.087-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.15-.175.2-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.676-1.63-.927-2.232-.244-.587-.492-.507-.676-.516-.175-.009-.376-.01-.577-.01-.2 0-.526.075-.802.376-.275.301-1.052 1.028-1.052 2.508 0 1.48 1.077 2.908 1.228 3.109.15.2 2.12 3.237 5.136 4.54.717.31 1.277.496 1.713.634.72.229 1.375.197 1.893.12.578-.087 1.78-.727 2.03-1.43.25-.702.25-1.304.175-1.43-.075-.125-.275-.201-.576-.351zM12.04 2C6.516 2 2.028 6.488 2.028 12.012c0 1.942.556 3.755 1.521 5.289L2 22.04l4.873-1.503a9.97 9.97 0 005.167 1.475h.004c5.524 0 10.012-4.488 10.012-10.012A10.01 10.01 0 0012.04 2zm0 18.318c-1.69 0-3.345-.45-4.792-1.304l-.343-.204-2.887.89.907-2.813-.223-.356A8.28 8.28 0 013.73 12.012c0-4.582 3.728-8.31 8.31-8.31 2.22 0 4.308.865 5.878 2.435a8.264 8.264 0 012.434 5.875c0 4.583-3.728 8.31-8.312 8.31z" />
                    </svg>
                  </div>
                  <div>
                    <span className="block text-xs uppercase font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      WhatsApp
                    </span>
                    <span className="font-medium group-hover:underline" style={{ color: 'var(--foreground)' }}>
                      (31) 99483-8720
                    </span>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="mailto:saturnoembalagens@yahoo.com.br"
                  className="text-sm no-underline transition-colors inline-flex items-center gap-2 group"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label="Envie um e-mail para saturnoembalagens@yahoo.com.br"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <svg
                      className="w-4 h-4"
                      style={{ color: 'var(--primary)' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs uppercase font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      E-mail
                    </span>
                    <span
                      className="font-medium break-all group-hover:underline"
                      style={{ color: 'var(--foreground)' }}
                    >
                      saturnoembalagens@yahoo.com.br
                    </span>
                  </div>
                </a>
              </li>
            </ul>
          </div>

          {/* Pickup Location Column */}
          <div>
            <h3
              className="font-semibold text-sm mb-5 flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
              Retirada
            </h3>
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <svg
                  className="w-4 h-4"
                  style={{ color: 'var(--primary)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--foreground)' }}>
                  R. Urupema, nº 150
                </p>
                <p className="text-sm mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  São Cosme de Baixo
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Santa Luzia - MG, 33130-140
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Company Legal Info & Rights */}
        <div
          className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="space-y-1">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              © 2026 SaturnoEmbalagens. Todos os direitos reservados.
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                50.288.867 RENATO SANTOS DA SILVA
              </span>{' '}
              • CNPJ: 50.288.867/0001-62
            </p>
          </div>
          <p className="text-xs flex items-center justify-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
            Feito com
            <svg
              className="w-3.5 h-3.5"
              style={{ color: 'var(--primary)' }}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            para seu negócio
          </p>
        </div>
      </div>
    </footer>
  );
}
