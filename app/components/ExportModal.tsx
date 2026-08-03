'use client';

import { useRef, useState } from 'react';
import { X, FileText, Instagram, MessageCircle, MapPin, Bed, Bath, Maximize, User } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Property } from '../context/DataContext';

interface ExportModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ property, isOpen, onClose }: ExportModalProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const igRef = useRef<HTMLDivElement>(null);
  const waRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportPDF = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Inmueble_${property.id}_PDF.pdf`);
    } catch (error) {
      console.error(error);
      alert('Error al exportar PDF');
    }
    setIsExporting(false);
  };

  const handleExportIG = async () => {
    if (!igRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(igRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Inmueble_${property.id}_IG.jpg`;
      link.click();
    } catch (error) {
      console.error(error);
      alert('Error al exportar para IG/TikTok');
    }
    setIsExporting(false);
  };

  const handleExportWA = async () => {
    if (!waRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(waRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Inmueble_${property.id}_WA.jpg`;
      link.click();
      
      const amenitiesText = property.amenities && property.amenities.length > 0 ? `\n✨ Comodidades: ${property.amenities.join(', ')}` : '';
      const text = `🏠 *${property.title}*\n📍 ${property.location}\n💰 *$${property.price.toLocaleString()} USD*\n🛏 ${property.beds} hab · 🚿 ${property.baths} baños · 📐 ${property.sqm}m²${amenitiesText}\n\nContactar: ${property.captador}`;
      const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
      setTimeout(() => {
        window.location.href = waUrl;
      }, 500);
    } catch (error) {
      console.error(error);
      alert('Error al exportar para WhatsApp');
    }
    setIsExporting(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl animate-fade-in-up">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-gray-900">Exportar Inmueble</h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-red-400 hover:bg-red-50 text-left transition disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">Ficha Técnica PDF</p>
                <p className="text-xs text-gray-500">Documento profesional</p>
              </div>
            </button>

            <button
              onClick={handleExportIG}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-pink-400 hover:bg-pink-50 text-left transition disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white rounded-lg flex items-center justify-center shrink-0">
                <Instagram size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">Historia (IG / TikTok)</p>
                <p className="text-xs text-gray-500">Formato vertical 9:16</p>
              </div>
            </button>

            <button
              onClick={handleExportWA}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 text-left transition disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center shrink-0">
                <MessageCircle size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">WhatsApp</p>
                <p className="text-xs text-gray-500">Imagen cuadrada + Texto</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/*
        FIX #2 — Las plantillas de exportación deben estar en el DOM y tener
        dimensiones reales para que html2canvas las renderice correctamente.
        NUNCA usar h-0/w-0 o overflow:hidden porque el canvas resultante queda vacío.
        Se usa position:fixed + visibility:hidden para que sean invisibles al usuario
        pero accesibles para el motor de renderizado del browser.
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {/* Plantilla PDF */}
        <div ref={pdfRef} className="bg-white text-black p-10 w-[794px] min-h-[1123px] flex flex-col font-sans">
          <div className="border-b-4 border-vinotinto pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-black text-gray-900">{property.title}</h1>
              <p className="text-lg text-gray-500 mt-2 flex items-center gap-2">
                <MapPin size={20} className="text-vinotinto" /> {property.location}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-vinotinto">${property.price.toLocaleString()} USD</p>
            </div>
          </div>
          <img src={property.image} crossOrigin="anonymous" className="w-full h-[400px] object-cover rounded-2xl mb-8 shadow-sm" alt="" />
          
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-2xl text-center border border-gray-100">
              <Bed size={32} className="mx-auto mb-2 text-vinotinto" />
              <p className="text-3xl font-bold text-gray-800">{property.beds}</p>
              <p className="text-sm text-gray-500">Habitaciones</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl text-center border border-gray-100">
              <Bath size={32} className="mx-auto mb-2 text-vinotinto" />
              <p className="text-3xl font-bold text-gray-800">{property.baths}</p>
              <p className="text-sm text-gray-500">Baños</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl text-center border border-gray-100">
              <Maximize size={32} className="mx-auto mb-2 text-vinotinto" />
              <p className="text-3xl font-bold text-gray-800">{property.sqm}m²</p>
              <p className="text-sm text-gray-500">Área</p>
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Descripción</h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">{property.description}</p>
            
            {property.amenities && property.amenities.length > 0 && (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Comodidades</h2>
                <div className="flex flex-wrap gap-3">
                  {property.amenities.map(amenity => (
                    <span key={amenity} className="px-4 py-2 bg-vinotinto/5 text-vinotinto border border-vinotinto/20 rounded-xl text-lg font-bold">
                      {amenity}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center gap-4 bg-gray-50 p-6 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-vinotinto flex items-center justify-center text-white">
              <User size={32} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Asesor Captador</p>
              <p className="text-xl font-bold text-gray-800">{property.captador}</p>
            </div>
          </div>
        </div>

        {/* Plantilla Historias IG/TikTok (9:16) */}
        <div ref={igRef} className="relative w-[1080px] h-[1920px] bg-gray-900 flex flex-col font-sans overflow-hidden">
          <img src={property.image} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
          <div className="relative z-10 p-16 flex flex-col h-full">
            <div className="mt-auto mb-10">
              <span className="bg-vinotinto text-white px-6 py-2 rounded-full text-2xl font-bold uppercase tracking-wider mb-6 inline-block">Nuevo Ingreso</span>
              <h1 className="text-7xl font-black text-white leading-tight mb-4">{property.title}</h1>
              <p className="text-4xl text-gray-300 flex items-center gap-4 mb-8">
                <MapPin size={40} className="text-vinotinto" /> {property.location}
              </p>
              <p className="text-[120px] font-black text-white leading-none mb-12">${property.price.toLocaleString()}</p>
              
              <div className="flex gap-8 mb-12">
                <div className="bg-white/20 backdrop-blur-md px-10 py-6 rounded-3xl text-center border border-white/30">
                  <p className="text-5xl font-bold text-white">{property.beds}</p>
                  <p className="text-2xl text-gray-200">Hab</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-10 py-6 rounded-3xl text-center border border-white/30">
                  <p className="text-5xl font-bold text-white">{property.baths}</p>
                  <p className="text-2xl text-gray-200">Baños</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-10 py-6 rounded-3xl text-center border border-white/30">
                  <p className="text-5xl font-bold text-white">{property.sqm}</p>
                  <p className="text-2xl text-gray-200">m²</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6 bg-white p-8 rounded-[40px] shadow-2xl">
              <div className="w-24 h-24 rounded-full bg-vinotinto flex items-center justify-center text-white shrink-0">
                <User size={48} />
              </div>
              <div>
                <p className="text-3xl text-gray-500">Contáctame:</p>
                <p className="text-4xl font-black text-gray-900">{property.captador}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Plantilla WhatsApp (Cuadrada 1:1) */}
        <div ref={waRef} className="relative w-[1080px] h-[1080px] bg-white flex flex-col font-sans overflow-hidden">
          <img src={property.image} crossOrigin="anonymous" className="w-full h-[600px] object-cover" alt="" />
          <div className="p-12 flex-1 flex flex-col bg-gray-50">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h1 className="text-5xl font-black text-gray-900 leading-tight">{property.title}</h1>
                <p className="text-3xl text-gray-500 mt-2">{property.location}</p>
              </div>
              <p className="text-5xl font-black text-vinotinto ml-4">${property.price.toLocaleString()}</p>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mt-auto">
              <div className="bg-white p-6 rounded-3xl text-center shadow-sm">
                <Bed size={40} className="mx-auto mb-2 text-vinotinto" />
                <p className="text-4xl font-bold text-gray-800">{property.beds}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl text-center shadow-sm">
                <Bath size={40} className="mx-auto mb-2 text-vinotinto" />
                <p className="text-4xl font-bold text-gray-800">{property.baths}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl text-center shadow-sm">
                <Maximize size={40} className="mx-auto mb-2 text-vinotinto" />
                <p className="text-4xl font-bold text-gray-800">{property.sqm}m²</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
