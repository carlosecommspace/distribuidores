const TEMPLATE = `sku,nombre,descripcion,categoria_slug,marca,unidad,costo_usd,precio_usd,stock,stock_min,stock_max,activo
ACE-001,Aceite Mobil 1 5W-30 Synthetic 1L,Aceite sintético para motor de gasolina,lubricantes,Mobil,unidad,8.50,12.50,24,6,,si
ACE-002,Aceite Castrol GTX 20W-50 4L,Aceite mineral multigrado garrafa 4 litros,lubricantes,Castrol,unidad,14.00,19.90,12,4,,si
FIL-101,Filtro de aceite Mann W712/52,Filtro de aceite universal compatible varios modelos,filtros,Mann,unidad,4.20,7.50,60,15,,si
FIL-102,Filtro de aire Toyota Corolla 2014-2018,Filtro de aire OEM para Corolla,filtros,OEM,unidad,6.00,11.00,18,8,,si
BAT-201,Batería Duncan 22NF 700A,Batería para auto sedan 12V,baterias,Duncan,unidad,75.00,110.00,8,3,,si
BAT-202,Batería Titan 27R 950A,Batería para SUV y camionetas,baterias,Titan,unidad,105.00,150.00,2,3,,si
BUJ-301,Bujía NGK BKR5E-11 x4,Pack de 4 bujías niquel,encendido,NGK,pack,7.00,12.00,40,10,,si
LIM-401,Detergente líquido Ariel 5L,Detergente concentrado garrafa 5 litros,detergentes,Ariel,unidad,9.00,14.50,30,10,,si
LIM-402,Cloro Las Llaves galón,Cloro líquido al 5 por ciento,cloros,Las Llaves,galón,2.50,4.50,80,20,,si
LIM-403,Lavaplatos Axion 750g,Crema lavaplatos pote 750 gramos,lavaplatos,Axion,unidad,1.80,3.20,120,30,,si
ALI-501,Arroz Mary 1kg fardo 24,Fardo de 24 paquetes de arroz blanco,granos,Mary,caja,28.00,42.00,15,5,,si
ALI-502,Aceite vegetal Vatel 1L caja 12,Caja de 12 botellas aceite vegetal,aceites-comestibles,Vatel,caja,30.00,48.00,10,4,,si
ALI-503,Harina PAN 1kg fardo 20,Fardo 20 paquetes harina precocida blanca,harinas,PAN,caja,22.00,34.00,18,6,,si
FER-601,Cemento Cemex gris 42.5kg,Saco cemento gris uso general,cemento,Cemex,saco,10.00,15.00,4,5,,si
FER-602,Tornillo autorroscante 6x1 caja 100,Caja 100 tornillos cabeza phillips,tornilleria,Genérico,caja,5.00,9.50,22,8,,si
FER-603,Pintura Montana blanco mate galón,Pintura látex blanco mate para interiores,pinturas,Montana,galón,14.00,22.00,14,4,,si
PAP-701,Papel higiénico Rosal x12,Pack 12 rollos doble hoja,papel-higienico,Rosal,pack,4.00,6.50,50,15,,si
PAP-702,Toallas femeninas Always pack,Pack 10 toallas con alas,higiene-femenina,Always,pack,2.20,3.80,70,20,,si
PAP-703,Pañales Pampers M paquete 40,Paquete 40 pañales talla M,panales,Pampers,paquete,9.00,14.00,0,6,,si
ELE-801,Cargador iPhone Lightning 1m,Cargador certificado MFi 1 metro,accesorios-celular,Genérico,unidad,3.50,7.00,45,10,,si
`

export async function GET() {
  return new Response(TEMPLATE, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="productos-distribos-template.csv"',
    },
  })
}
