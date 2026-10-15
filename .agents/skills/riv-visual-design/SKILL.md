---
name: riv-visual-design
description: Sistema de diseño visual y estética de lujo para RIV Margarita Premier. Define la paleta de colores corporativa (vinotinto, dorado, grises), efectos de glassmorphism, tipografía, microanimaciones con Framer Motion, diseño móvil responsivo y componentes premium.
---

# Sistema de Diseño Visual — RIV Margarita Premier

Este skill define los estándares visuales, tokens de estilo y patrones de interacción para toda la interfaz de la aplicación **RIV Margarita Premier**. Debe aplicarse de manera consistente en todas las vistas (Dashboard, Inventario, CRM, Citas, Perfil y componentes compartidos).

---

## 1. Identidad de Marca y Paleta de Colores

La estética del proyecto es **automotriz de lujo**, combinando elegancia, sobriedad y dinamismo.

### Colores Principales (Tailwind)
- **Vinotinto (`vinotinto`)**: Color insignia de la marca.
  - `DEFAULT`: `#800020` (Color primario de acción, headers, botones principales).
  - `light`: `#A32947` (Hover states, degradados activos).
  - `dark`: `#590016` (Bordes profundos, fondos oscuros de contraste).

- **Dorado (`dorado`)**: Acentos de exclusividad y lujo.
  - `DEFAULT`: `#D4AF37` (Badges premium, íconos de destaque, bordes sutiles).
  - `light`: `#E6C96C` (Efectos de brillo, hover en elementos dorados).
  - `dark`: `#997E25` (Textos de contraste sobre fondos claros).

- **Neutros y Fondos**:
  - Fondo global de página: `#F3F4F6` (`bg-gray-100` o `bg-gris-claro`).
  - Superficies de tarjetas: `#FFFFFF` con soporte de opacidad/blur.
  - Texto principal: `#1F2937` (`text-gray-800` / `text-gris-oscuro`).
  - Texto secundario / muted: `#6B7280` (`text-gray-500`).

---

## 2. Tipografía y Jerarquía Visual

- **Fuente Principal**: Inter / System UI (`font-sans`).
- **Títulos de Pantalla**: `text-2xl font-bold text-gray-900 tracking-tight`.
- **Subtítulos y Metadatos**: `text-sm font-medium text-gray-500`.
- **Badges y Etiquetas**: `text-xs font-semibold uppercase tracking-wider`.
- **Números de Métricas / Precios**: `font-bold tracking-tight text-vinotinto` o `text-gray-900`.

---

## 3. Efectos Visuales: Glassmorphism y Elevación

### Tarjeta Estándar Premium (Glassmorphism sutil)
```tsx
<div className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
  {/* Contenido */}
</div>
```

### Tarjeta Destacada / VIP (Acento Dorado)
```tsx
<div className="bg-white/90 backdrop-blur-md border border-dorado/30 rounded-2xl p-5 shadow-md shadow-dorado/5 hover:border-dorado/60 transition-all duration-300">
  {/* Contenido */}
</div>
```

### Gradientes de Marca
- **Gradiente Vinotinto**: `bg-gradient-to-r from-[#800020] to-[#A32947]`
- **Gradiente Dorado**: `bg-gradient-to-r from-[#D4AF37] to-[#E6C96C]`
- **Gradiente Superficie**: `bg-gradient-to-b from-white to-gray-50/50`

---

## 4. Microanimaciones con Framer Motion

El proyecto cuenta con `framer-motion` instalado. Debe utilizarse para que la interfaz se sienta fluida, viva y moderna.

### A. Botón con Retroalimentación Háptica/Visual
```tsx
import { motion } from 'framer-motion';

<motion.button
  whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
  whileTap={{ scale: 0.97 }}
  className="px-5 py-2.5 rounded-xl bg-vinotinto text-white font-medium shadow-md shadow-vinotinto/20 hover:bg-vinotinto-light transition-colors"
>
  Guardar Cambios
</motion.button>
```

### B. Animación de Entrada Escalonada (Staggered Grid / Listas)
```tsx
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
};

export function CardGrid({ items }) {
  return (
    <motion.div 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {items.map((item) => (
        <motion.div key={item.id} variants={itemVariants}>
          {/* Card Component */}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### C. Modales y Overlays Suaves
```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isOpen && (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        {/* Modal Body */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

---

## 5. Reglas de Compatibilidad Móvil y Layout (iOS / PWA)

1. **Bottom Navigation Bar**:
   - Todo contenedor de pantalla principal debe incluir la clase `.page-content` o un padding inferior suficiente (`pb-24` / `pb-safe`) para que los elementos flotantes o el footer no oculten botones críticos.
2. **Modales Centrados**:
   - Utilizar las clases `.modal-overlay` y `.modal-container` definidas en `app/globals.css` para evitar choques con el tab bar inferior en iPhones con notch / barra home.
3. **Inputs en iOS**:
   - Respetar `font-size: 16px` para evitar zoom automático del navegador al hacer focus.
   - Altura mínima táctil de 44px a 48px para botones y selectores.

---

## 6. Checklist de Calidad Visual Antes de Finalizar Cambios

- [ ] ¿Los colores respetan la jerarquía Vinotinto (`#800020`) y Dorado (`#D4AF37`)?
- [ ] ¿Las tarjetas usan bordes suaves (`rounded-2xl` o `rounded-xl`) y sombras sutiles con bordes de 1px?
- [ ] ¿Los botones tienen estados `:hover`, `:active` y `whileTap`?
- [ ] ¿Los estados de carga (skeletons o spinners) usan los tonos del tema y animaciones suaves?
- [ ] ¿El contraste de texto sobre fondos oscuros o vinotinto es claro y accesible?
- [ ] ¿Se ve impecable tanto en pantallas móviles como en monitores de escritorio?
