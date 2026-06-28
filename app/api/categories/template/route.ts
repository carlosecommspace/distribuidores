const TEMPLATE = `nombre,slug,categoria_padre,descripcion,color
Repuestos automotrices,repuestos-automotrices,,Repuestos y accesorios para vehículos,#F5A623
Lubricantes,lubricantes,repuestos-automotrices,Aceites y grasas para motor y transmisión,
Filtros,filtros,repuestos-automotrices,Filtros de aceite aire combustible y aire acondicionado,
Frenos,frenos,repuestos-automotrices,Pastillas discos y líquido de freno,
Suspensión,suspension,repuestos-automotrices,Amortiguadores rótulas y bujes,
Encendido,encendido,repuestos-automotrices,Bujías cables y bobinas,
Baterías,baterias,repuestos-automotrices,Baterías para auto y moto,
Alimentos,alimentos,,Productos alimenticios al mayor,#4ADE80
Granos,granos,alimentos,Arroz caraotas lentejas,
Harinas,harinas,alimentos,Harina precocida pastificios,
Aceites comestibles,aceites-comestibles,alimentos,Aceites vegetales mixtos,
Bebidas,bebidas,alimentos,Refrescos jugos agua mineral,
Lácteos,lacteos,alimentos,Leche queso mantequilla,
Limpieza,limpieza,,Productos de limpieza del hogar,#60A5FA
Detergentes,detergentes,limpieza,Detergente en polvo y líquido,
Cloros y desinfectantes,cloros,limpieza,Cloro alcohol desinfectantes,
Lavaplatos,lavaplatos,limpieza,Crema gel y líquido para lavar platos,
Jabones,jabones,limpieza,Jabón de panela y barra,
Ferretería,ferreteria,,Materiales y herramientas de construcción,#A78BFA
Cemento y morteros,cemento,ferreteria,Cemento gris cal arena,
Tornillería,tornilleria,ferreteria,Tornillos clavos tuercas,
Pinturas,pinturas,ferreteria,Pintura solventes y brochas,
Eléctricos,electricos,ferreteria,Cableado tomacorrientes interruptores,
Plomería,plomeria,ferreteria,Tuberías llaves accesorios,
Cuidado personal,cuidado-personal,,Higiene y aseo personal,#FBBF24
Papel higiénico,papel-higienico,cuidado-personal,Papel higiénico de varias presentaciones,
Pañales,panales,cuidado-personal,Pañales desechables bebé y adulto,
Higiene femenina,higiene-femenina,cuidado-personal,Toallas y tampones,
Cuidado bucal,cuidado-bucal,cuidado-personal,Pasta cepillos y enjuague,
Shampoo y jabón corporal,shampoo,cuidado-personal,Shampoo acondicionador jabón en barra,
Bebidas alcohólicas,bebidas-alcoholicas,,Cervezas vinos y licores,#F87171
Cervezas,cervezas,bebidas-alcoholicas,Cervezas nacionales e importadas,
Licores,licores,bebidas-alcoholicas,Ron whisky vodka tequila,
Vinos,vinos,bebidas-alcoholicas,Vinos tintos blancos y rosados,
Electrónica,electronica,,Electrodomésticos y accesorios,#22D3EE
Accesorios para celular,accesorios-celular,electronica,Cargadores cables forros,
Audio,audio,electronica,Cornetas audífonos y micrófonos,
Hogar,hogar,,Artículos para el hogar,#E879F9
Cocina,cocina,hogar,Utensilios ollas y vajilla,
Plásticos,plasticos,hogar,Envases tobos y baldes,
Textiles,textiles,hogar,Sábanas toallas paños,
`

export async function GET() {
  return new Response(TEMPLATE, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="categorias-distribos-template.csv"',
    },
  })
}
