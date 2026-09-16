import { Link } from '@tanstack/react-router';

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface CategoryMenuProps {
  categories: Category[];
}

export function CategoryMenu({ categories }: CategoryMenuProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          to="/catalog/$categorySlug"
          params={{ categorySlug: category.slug }}
          className="group block no-underline rounded-2xl overflow-hidden transition-all duration-200"
          style={{ backgroundColor: '#002233', border: '1px solid rgba(255,65,3,0.12)' }}
        >
          <div
            className="flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
            style={{ height: '100px', backgroundColor: 'rgba(255,65,3,0.06)' }}
          >
            {category.image_url ? (
              <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-4">
                <svg className="w-10 h-10 mx-auto mb-1" style={{ color: '#FF4103' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )}
          </div>
          <div className="p-3 text-center">
            <h3 className="font-semibold text-sm" style={{ color: '#F5F5DC' }}>
              {category.name}
            </h3>
          </div>
        </Link>
      ))}
    </div>
  );
}
