'use client';

import { useState } from 'react';
import { MapPin, Check, ArrowRight, ArrowLeft, UserCheck, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ImageUploader from '../../components/ImageUploader';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

export default function RegistroPropiedad() {
  const router = useRouter();
  const { addProperty } = useData();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    precio: '',
    habitaciones: '',
    banos: '',
    area: '',
    descripcion: '',
    ubicacion: '',
    imagenes: [] as string[],
    status: 'Activa',
    amenities: [] as string[],
  });

  const AMENITIES_OPTIONS = [
    'Piscina', 'Planta Eléctrica', 'Pozo de Agua', 
    'Vigilancia 24/7', 'Amoblado', 'Vista al Mar', 
    'Gimnasio', 'Ascensor', 'Estacionamiento Techado'
  ];

  const handleAmenityToggle = (amenity: string) => {
    setFormData(prev => {
      const isSelected = prev.amenities.includes(amenity);
      if (isSelected) {
        return { ...prev, amenities: prev.amenities.filter(a => a !== amenity) };
      } else {
        return { ...prev, amenities: [...prev.amenities, amenity] };
      }
    });
  };

  const handleUploadComplete = (urls: string[]) => {
    setFormData(prev => ({ ...prev, imagenes: urls }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const canProceed = () => {
    if (step === 1) return formData.titulo.trim() && formData.precio && formData.ubicacion.trim();
    if (step === 3) return formData.imagenes.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (formData.imagenes.length === 0) {
      alert('Por favor sube al menos una foto de la propiedad.');
      return;
    }
    setIsSubmitting(true);
    
    // Simular guardado (en producción iría a Supabase)
    await new Promise(r => setTimeout(r, 800));
    
    const newId = addProperty({
      title: formData.titulo,
      price: Number(formData.precio),
      location: formData.ubicacion,
      beds: Number(formData.habitaciones) || 0,
      baths: Number(formData.banos) || 0,
      sqm: Number(formData.area) || 0,
      description: formData.descripcion,
      image: formData.imagenes[0],
      images: formData.imagenes,
      status: formData.status,
      captador: user?.nombre ?? 'Asesor',
      amenities: formData.amenities,
    });

    setIsSubmitting(false);
    setSubmitted(true);
    
    // Redirigir al detalle del inmueble recién creado
    setTimeout(() => router.push(`/inventario/${newId}`), 1500);
  };

  // Pantalla de éxito
  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-800 mb-2">¡Inmueble Publicado!</h2>
        <p className="text-sm text-gray-500">Ya está visible en el inventario de toda la agencia.</p>
        <p className="text-xs text-gray-400 mt-3">Redirigiendo al detalle...</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50">
      
      {/* HEADER */}
      <header className="flex items-center justify-between mb-6 pt-2">
        <button onClick={() => step > 1 ? setStep(step - 1) : router.back()} className="p-2 -ml-2 text-gray-500 hover:text-vinotinto transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Registrar Inmueble</h1>
        <div className="w-8"></div>
      </header>

      {/* STEPPER */}
      <div className="flex justify-between items-center mb-8 relative">
        <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-vinotinto transition-all duration-500" 
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
              step > i ? 'bg-vinotinto text-white scale-90' : step === i ? 'bg-vinotinto text-white ring-4 ring-vinotinto/20' : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            {step > i ? <Check size={16} /> : i}
          </div>
        ))}
      </div>

      {/* FORMULARIO */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
        
        {/* ASESOR CAPTADOR */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl mb-5">
          <UserCheck className="text-vinotinto shrink-0" size={18} />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Captado por</p>
            <p className="text-sm font-bold text-gray-800">{user?.nombre ?? 'Asesor'}</p>
          </div>
        </div>

        {/* PASO 1: DATOS BÁSICOS */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-vinotinto mb-4">📋 Datos Básicos</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título del Inmueble *</label>
              <input 
                type="text" name="titulo" value={formData.titulo} onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none"
                placeholder="Ej: Apartamento Vista al Mar"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación *</label>
              <input 
                type="text" name="ubicacion" value={formData.ubicacion} onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none"
                placeholder="Ej: Pampatar, Isla de Margarita"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio (USD) *</label>
              <input 
                type="number" name="precio" value={formData.precio} onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none"
                placeholder="Ej: 45000"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">m²</label>
                <input type="number" name="area" value={formData.area} onChange={handleInputChange}
                  className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-1 focus:ring-vinotinto outline-none"
                  placeholder="85" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Habs.</label>
                <input type="number" name="habitaciones" value={formData.habitaciones} onChange={handleInputChange}
                  className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-1 focus:ring-vinotinto outline-none"
                  placeholder="3" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Baños</label>
                <input type="number" name="banos" value={formData.banos} onChange={handleInputChange}
                  className="w-full p-3 border border-gray-200 rounded-xl text-center focus:ring-1 focus:ring-vinotinto outline-none"
                  placeholder="2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select name="status" value={formData.status} onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none bg-white">
                <option value="Activa">✅ Activa</option>
                <option value="Suspendida">⏸ Suspendida</option>
                <option value="Vendida">✔️ Vendida</option>
              </select>
            </div>
          </div>
        )}

        {/* PASO 2: DESCRIPCIÓN Y COMODIDADES */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-vinotinto mb-4">📝 Descripción</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción detallada</label>
              <textarea 
                name="descripcion" value={formData.descripcion} onChange={handleInputChange} rows={6}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-vinotinto outline-none resize-none"
                placeholder="Describe los detalles del inmueble: acabados, estado de la propiedad, ventajas de la ubicación..."
              />
              <p className="text-xs text-gray-400 mt-1">{formData.descripcion.length} caracteres · Una buena descripción atrae más clientes.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-vinotinto mb-3">✨ Comodidades</h2>
              <p className="text-xs text-gray-500 mb-3">Selecciona todas las comodidades con las que cuenta el inmueble.</p>
              <div className="flex flex-wrap gap-2">
                {AMENITIES_OPTIONS.map(amenity => {
                  const isSelected = formData.amenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      onClick={() => handleAmenityToggle(amenity)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        isSelected 
                          ? 'bg-vinotinto text-white border-vinotinto shadow-sm' 
                          : 'bg-white text-gray-600 border-gray-200 hover:border-vinotinto/50'
                      }`}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: IMÁGENES */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-vinotinto mb-1">📸 Fotografías</h2>
            <p className="text-xs text-gray-500 mb-4">
              Las fotos se suben a Cloudinary. La primera será la foto de portada.
            </p>
            <ImageUploader onUploadComplete={handleUploadComplete} maxImages={10} />
            {formData.imagenes.length > 0 && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-green-800 text-xs flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500 shrink-0" />
                <span><strong>{formData.imagenes.length}</strong> foto(s) lista(s).</span>
              </div>
            )}
          </div>
        )}

        {/* PASO 4: REVISIÓN */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-vinotinto mb-4">✅ Revisar y Publicar</h2>
            
            <div className="space-y-3">
              {[
                { label: 'Título', value: formData.titulo || '—' },
                { label: 'Ubicación', value: formData.ubicacion || '—' },
                { label: 'Precio', value: formData.precio ? `$${Number(formData.precio).toLocaleString()} USD` : '—' },
                { label: 'Características', value: `${formData.habitaciones || 0} hab · ${formData.banos || 0} baños · ${formData.area || 0}m²` },
                { label: 'Estado', value: formData.status },
                { label: 'Fotos', value: `${formData.imagenes.length} imagen(es)` },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-800 text-right max-w-[60%]">{item.value}</span>
                </div>
              ))}
              <div className="py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 block mb-1">Comodidades</span>
                <span className="text-sm font-semibold text-gray-800">
                  {formData.amenities.length > 0 ? formData.amenities.join(', ') : 'Ninguna seleccionada'}
                </span>
              </div>
            </div>
            
            {formData.imagenes.length === 0 && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-700 text-sm">
                ⚠️ Debes subir al menos una foto en el paso 3.
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Atrás
          </button>
        )}
        
        {step < totalSteps ? (
          <button 
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className={`flex-[2] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
              canProceed() 
                ? 'bg-vinotinto text-white active:scale-95' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Siguiente <ArrowRight size={18} />
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || formData.imagenes.length === 0}
            className="flex-[2] py-3.5 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-60"
          >
            {isSubmitting ? 'Guardando...' : <>Publicar Inmueble <Check size={18} /></>}
          </button>
        )}
      </div>
    </div>
  );
}
