const form = document.querySelector("#arama-formu");
const sehirInput = document.querySelector("#sehir");
const mesaj = document.querySelector("#mesaj");
const sonuc = document.querySelector("#sonuc");
const gecmisAlani = document.querySelector("#gecmis-alani");
const gecmisKutusu = document.querySelector("#gecmis");
const konumButonu = document.querySelector("#konum-butonu");
const birimSecici = document.querySelector("#birim");
let sonArama = null;

const havaKodlari = {
  0: ["Açık", "☀️"],
  1: ["Az bulutlu", "🌤️"],
  2: ["Parçalı bulutlu", "⛅"],
  3: ["Bulutlu", "☁️"],
  45: ["Sisli", "🌫️"],
  48: ["Kırağı sisli", "🌫️"],
  51: ["Hafif çiseleme", "🌦️"],
  61: ["Yağmurlu", "🌧️"],
  71: ["Hafif kar", "🌨️"],
  80: ["Sağanak yağış", "🌧️"],
  95: ["Gök gürültülü fırtına", "⛈️"]
};

form.addEventListener("submit", async (olay) => {
  olay.preventDefault();
  havaDurumunuGetir(sehirInput.value.trim());
});

async function havaDurumunuGetir(sehir) {
  if (!sehir) return;

  mesaj.textContent = "Yükleniyor...";
  sonuc.classList.add("gizli");

  try {
    // Önce şehir adını enlem ve boylam bilgisine çeviriyoruz.
    const konumYaniti = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sehir)}&count=1&language=tr&format=json`
    );
    const konumVerisi = await konumYaniti.json();
    const konum = konumVerisi.results?.[0];

    if (!konum) {
      throw new Error("Şehir bulunamadı. Yazımı kontrol edip tekrar dene.");
    }

    // Bulduğumuz konumla güncel hava verisini istiyoruz.
    const havaYaniti = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${konum.latitude}&longitude=${konum.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    const havaVerisi = await havaYaniti.json();
    sonArama = { konum, hava: havaVerisi.current, gunluk: havaVerisi.daily };
    ekranaYaz();
    gecmiseEkle(konum.name);
    mesaj.textContent = "";
  } catch (hata) {
    mesaj.textContent = hata.message || "Bir sorun oluştu. Tekrar dene.";
  }
}

function ekranaYaz() {
  if (!sonArama) return;

  const { konum, hava, gunluk } = sonArama;
  const [aciklama, emoji] = havaKodlari[hava.weather_code] || ["Bilinmiyor", "🌡️"];

  document.querySelector("#sehir-adi").textContent = konum.country ? `${konum.name}, ${konum.country}` : konum.name;
  document.querySelector("#sicaklik").textContent = sicaklikYaz(hava.temperature_2m);
  document.querySelector("#ikon").textContent = emoji;
  document.querySelector("#durum").textContent = aciklama;
  document.querySelector("#nem").textContent = `%${hava.relative_humidity_2m}`;
  document.querySelector("#ruzgar").textContent = `${hava.wind_speed_10m} km/sa`;

  tahminiYaz(gunluk);
  arkaPlaniDegistir(hava.weather_code);

  sonuc.classList.remove("gizli");
}

function sicaklikYaz(celsius) {
  if (birimSecici.value === "F") return `${Math.round((celsius * 9) / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

function tahminiYaz(gunluk) {
  const tahminKutusu = document.querySelector("#tahmin");
  tahminKutusu.innerHTML = "";

  gunluk.time.forEach((tarih, index) => {
    const gun = new Date(`${tarih}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "short" });
    const [, emoji] = havaKodlari[gunluk.weather_code[index]] || ["", "🌡️"];
    tahminKutusu.innerHTML += `
      <article class="gun">
        <p>${gun}</p>
        <p class="hava-emoji">${emoji}</p>
        <p>${sicaklikYaz(gunluk.temperature_2m_max[index])} / ${sicaklikYaz(gunluk.temperature_2m_min[index])}</p>
      </article>`;
  });
}

konumButonu.addEventListener("click", () => {
  if (!navigator.geolocation) {
    mesaj.textContent = "Tarayıcın konum özelliğini desteklemiyor.";
    return;
  }

  mesaj.textContent = "Konumun alınıyor...";
  navigator.geolocation.getCurrentPosition(konumuKullan, konumHatasi, { enableHighAccuracy: true });
});

async function konumuKullan(pozisyon) {
  const { latitude, longitude } = pozisyon.coords;

  try {
    const havaYaniti = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    const havaVerisi = await havaYaniti.json();
    sonArama = { konum: { name: "Mevcut konum" }, hava: havaVerisi.current, gunluk: havaVerisi.daily };
    ekranaYaz();
    mesaj.textContent = "";
  } catch {
    mesaj.textContent = "Hava durumu alınamadı. Tekrar dene.";
  }
}

function konumHatasi() {
  mesaj.textContent = "Konum izni verilmedi. Bir şehir adıyla arama yapabilirsin.";
}

birimSecici.addEventListener("change", ekranaYaz);

function arkaPlaniDegistir(kod) {
  document.body.className = "";
  if ([51, 61, 80, 95].includes(kod)) document.body.classList.add("yagmurlu");
  else if ([71].includes(kod)) document.body.classList.add("karli");
  else if ([2, 3, 45, 48].includes(kod)) document.body.classList.add("bulutlu");
}

function gecmiseEkle(sehir) {
  const onceki = JSON.parse(localStorage.getItem("arananSehirler")) || [];
  const sehirler = [sehir, ...onceki.filter((ad) => ad.toLocaleLowerCase("tr-TR") !== sehir.toLocaleLowerCase("tr-TR"))].slice(0, 5);
  localStorage.setItem("arananSehirler", JSON.stringify(sehirler));
  gecmisiGoster();
}

function gecmisiGoster() {
  const sehirler = JSON.parse(localStorage.getItem("arananSehirler")) || [];
  gecmisKutusu.innerHTML = "";
  gecmisAlani.classList.toggle("gizli", sehirler.length === 0);

  sehirler.forEach((sehir) => {
    const buton = document.createElement("button");
    buton.textContent = sehir;
    buton.addEventListener("click", () => {
      sehirInput.value = sehir;
      havaDurumunuGetir(sehir);
    });
    gecmisKutusu.appendChild(buton);
  });
}

gecmisiGoster();
