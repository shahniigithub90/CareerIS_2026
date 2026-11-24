// Update alumni LinkedIn URLs in MongoDB Atlas
// Run with: node updateLinkedIn.js
require('dotenv').config();
const mongoose = require('mongoose');

// Clean a LinkedIn URL — strip tracking params and /overlay/contact-info/
function cleanUrl(url) {
    if (!url) return null;
    url = url.trim();
    url = url.replace(/\/overlay\/contact-info\/?/g, '/');
    url = url.split('?')[0];
    url = url.replace(/\/\/$/, '/');
    if (!url.endsWith('/')) url += '/';
    return url;
}

// Normalize a name for fuzzy matching:
// lowercase, remove common prefixes, collapse spaces
function norm(name) {
    return name
        .toLowerCase()
        .replace(/\b(syeda|hafiza|umm\s*e|ummul|dr\.?|ms\.?|mrs\.?)\b/gi, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Alumni LinkedIn data — name → url
const alumniData = [
    // Batch 2022
    { name: 'Fahama Farooq',          url: 'https://www.linkedin.com/in/fahama-farooq-92a726275/' },
    { name: 'Sana Ghulam Muhammad',   url: 'https://www.linkedin.com/in/sana-ghulam-muhammad-6696b4296/' },
    { name: 'Shumail Rafaqat',        url: 'https://www.linkedin.com/in/shumail-rafaqat-55334a320/' },
    { name: 'Khadija Ayub',           url: 'https://www.linkedin.com/in/khadija-ayub-b99359252/' },
    { name: 'Nimra Aamir',            url: 'https://www.linkedin.com/in/nimra-amir-7989b8272/' },
    { name: 'Rija Fatima',            url: 'https://www.linkedin.com/in/rija-fatima-77b508279/' },
    { name: 'Ayesha Fahim',           url: 'https://www.linkedin.com/in/ayesha-fahim/' },
    { name: 'Hafsa Farhan',           url: 'https://www.linkedin.com/in/hafsa-farhan-ba678a30b/' },
    { name: 'Vira Siddiqui',          url: 'https://www.linkedin.com/in/vira-siddiqui-523b90265/' },
    { name: 'Momina Sheikh',          url: 'https://www.linkedin.com/in/momina-sheikh-dev/' },
    { name: 'Iman Nadeem',            url: 'https://www.linkedin.com/in/iman-nadeem-841909279/' },
    { name: 'Huda Noor',              url: 'https://www.linkedin.com/in/huda-noor-28541126b/' },
    { name: 'Nimish Khan',            url: 'https://www.linkedin.com/in/nimish-khan-0061b9256/' },
    { name: 'Umm e Hani Baig',        url: 'https://www.linkedin.com/in/hani-baig-b006a5262/' },
    { name: 'Sara Jawed',             url: 'https://www.linkedin.com/in/sara-jawed-a0293325a/' },
    { name: 'Eisha Mushtaq',          url: 'https://www.linkedin.com/in/eisha-mushtaq-797212274/' },
    { name: 'Aiman Iqbal',            url: 'https://www.linkedin.com/in/aiman-iqbal-41a543268/' },
    { name: 'Zaibunisa Arif',         url: 'https://www.linkedin.com/in/zaib-un-nisa-arif-ali-3a4b3830a/' },
    { name: 'Ramsha Sharif',          url: 'https://www.linkedin.com/in/ramsha-sharif-8a0b14288/' },
    { name: 'Warda Altaf',            url: 'https://www.linkedin.com/in/warda-altaf-a85763304/' },
    { name: 'Hudaibia Feroz',         url: 'https://www.linkedin.com/in/hudaibia-feroz-b358a628a/' },
    { name: 'Hiba Sharif',            url: 'https://www.linkedin.com/in/hiba-s-257a25264/' },
    { name: 'Laiba Irfan',            url: 'https://www.linkedin.com/in/laiba-irfan-145bab2a4/' },
    { name: 'Javeria Jalal',          url: 'https://www.linkedin.com/in/javeria-jalal-shahid-9244282a3/' },
    // Batch 2021
    { name: 'Laiba Khalid',           url: 'https://www.linkedin.com/in/laibakhalid123/' },
    { name: 'Rida Sheikh',            url: 'https://www.linkedin.com/in/rida-sheikh24/' },
    { name: 'Maria Aqdas',            url: 'https://www.linkedin.com/in/mariaaqdas/' },
    { name: 'Mifra Tanveer',          url: 'https://www.linkedin.com/in/mifratanveer/' },
    { name: 'Warisha Yaseen',         url: 'https://www.linkedin.com/in/warisha-yaseen-2b349b280/' },
    { name: 'Ayesha Zubairi',         url: 'https://www.linkedin.com/in/ayesha-zubairi-087b14178/' },
    { name: 'Arham Shaikh',           url: 'https://www.linkedin.com/in/arham-shaikh-9a990b1b5/' },
    { name: 'Ramsha Imran',           url: 'https://www.linkedin.com/in/ramshaimran8056/' },
    { name: 'Midhat Khan',            url: 'https://www.linkedin.com/in/midhat-khan-28566a245/' },
    { name: 'Tahrim',                 url: 'https://www.linkedin.com/in/tahrim-altaf/' },
    { name: 'Ayesha Kanwal',          url: 'https://www.linkedin.com/in/ayesha-kanwal-041b55290/' },
    { name: 'Ayesha Ghayour',         url: 'https://www.linkedin.com/in/ayesha-kooko-55b5ab251/' },
    { name: 'Khadija Faheem',         url: 'https://www.linkedin.com/in/khadija-f-b70b4926a/' },
    { name: 'Syeda Urooba Amjad',     url: 'https://www.linkedin.com/in/syeda-urooba-amjad-b529b01bb/' },
    { name: 'Jannat Siddique',        url: 'https://www.linkedin.com/in/jannat-siddique/' },
    { name: 'Nida Maqbool',           url: 'https://www.linkedin.com/in/nida-maqbool-aa5069201/' },
    { name: 'Wasifa Asad Khan',       url: 'https://www.linkedin.com/in/wasifa-asad-khan-72b6a8232/' },
    { name: 'Zareen Khan',            url: 'https://www.linkedin.com/in/zareen-khan-61a94620b/' },
    { name: 'Zoya Dilshad',           url: 'https://www.linkedin.com/in/zoya-dilshad-210316247/' },
    { name: 'Muskan Abdul Razzak',    url: 'https://www.linkedin.com/in/muskan-abdul-razzak-3abb92238/' },
    { name: 'Urooba Abdul Sattar',    url: 'https://www.linkedin.com/in/urooba-abdul-sattar-7b6b2828a/' },
    { name: 'Humna Siddiqui',         url: 'https://www.linkedin.com/in/humna-siddiqui/' },
    { name: 'Irza Hasan',             url: 'https://www.linkedin.com/in/irza-hasan-486414216/' },
    { name: 'Khatiba Amir',           url: 'https://www.linkedin.com/in/khatiba-amir-387516234/' },
    { name: 'Maryam Raza',            url: 'https://www.linkedin.com/in/maryam-raza-1b647b234/' },
    { name: 'Hafiza Arshmah',         url: 'https://www.linkedin.com/in/hafiza-arshmah-a7a3171b4/' },
    { name: 'Fizza Tariq',            url: 'https://www.linkedin.com/in/fizza-tariq-webdev09/' },
    { name: 'Dua Aijaz',              url: 'https://www.linkedin.com/in/dua-aijaz-30586a22b/' },
    { name: 'Bushra Jamal',           url: 'https://www.linkedin.com/in/bushrajamal/' },
    { name: 'Iqra Abid',              url: 'https://www.linkedin.com/in/iqra-abid-418bb6370/' },
    { name: 'Ayesha Arif',            url: 'https://www.linkedin.com/in/ayesha-arif-a5ba37266/' },
    { name: 'Areesha Amir',           url: 'https://www.linkedin.com/in/areesha-amir-7b442b206/' },
    { name: 'Iqra Muhammad Amir',     url: 'https://www.linkedin.com/in/iqra-abid-418bb6370/' },
    { name: 'Anum Furqan Akbani',     url: 'https://www.linkedin.com/in/anum-furqan-akbani-141b85290/' },
    { name: 'Sawera Rasheed',         url: 'https://www.linkedin.com/in/sawera-rasheed/' },
    // Batch 2020
    { name: 'Mashal Noor',            url: 'https://www.linkedin.com/in/mashal-noor-2b3719208/' },
    { name: 'Umna Khan',              url: 'https://www.linkedin.com/in/umna-khan-897ab6230/' },
    { name: 'Manahil Azhar',          url: 'https://www.linkedin.com/in/manahil-ali-162974233/' },
    { name: 'Syeda Aleeza Moazzam',   url: 'https://www.linkedin.com/in/syeda-aleeza/' },
    { name: 'Mahnoor Sohail',         url: 'https://www.linkedin.com/in/mahnoor-sohail-ab74621b8/' },
    { name: 'Nashra Meraj',           url: 'https://www.linkedin.com/in/nashra-meraj/' },
    { name: 'Manal Fouad',            url: 'https://www.linkedin.com/in/manal-fouad-668036220/' },
    { name: 'Syeda Parsa Shereen',    url: 'https://www.linkedin.com/in/syeda-parsa-shereen-9668b4234/' },
    { name: 'Rafia Waseem',           url: 'https://www.linkedin.com/in/rafia-waseem-885632248/' },
    { name: 'Bakhtawar Siraj',        url: 'https://www.linkedin.com/in/bakhtawar-siraj-317612232/' },
    { name: 'Kainat Nasir',           url: 'https://www.linkedin.com/in/kainat-nasir-5a800a232/' },
    { name: 'Aisha Khalid',           url: 'https://www.linkedin.com/in/aisha-khalid-95610220a/' },
    { name: 'Ravieha Haleem',         url: 'https://www.linkedin.com/in/ravieha-haleem/' },
    { name: 'Syeda Fazila Ali',       url: 'https://www.linkedin.com/in/syedafazilaali/' },
    { name: 'Ummul Qura Mehdi',       url: 'https://www.linkedin.com/in/ummul-qura-mehdi-3415581b1/' },
    { name: 'Ujala Shah',             url: 'https://www.linkedin.com/in/ujala-shah-874b2a249/' },
    { name: 'Laiba Zahid',            url: 'https://www.linkedin.com/in/laiba-zahid-389b8b249/' },
    { name: 'Samreen Aziz',           url: 'https://www.linkedin.com/in/samreen-aziz-aa2165279/' },
    { name: 'Hifza Jabeen',           url: 'https://www.linkedin.com/in/hifza-jabeen-3761b3231/' },
    { name: 'Insharah Riaz',          url: 'https://www.linkedin.com/in/insharah-riaz-0829951b9/' },
    { name: 'Arisha Shahid',          url: 'https://www.linkedin.com/in/arisha-shahid-/' },
    { name: 'Hadia Naeem',            url: 'https://www.linkedin.com/in/hadia-naeem-76a53620b/' },
    { name: 'Shaveena Khan',          url: 'https://www.linkedin.com/in/shaveena-khan-012477289/' },
    { name: 'Tazeen Nasir',           url: 'https://www.linkedin.com/in/tazeen-nasir-na0um8an/' },
    { name: 'Aisha Azhar',            url: 'https://www.linkedin.com/in/-aisha-azhar-/' },
    { name: 'Aneeqa Asif',            url: 'https://www.linkedin.com/in/aneeqa-asif-83768b212/' },
    { name: 'Ayesha Munir',           url: 'https://www.linkedin.com/in/ayeshaa-munir/' },
    { name: 'Bilquees Muhammad',      url: 'https://www.linkedin.com/in/bilquees-motiwala-6bb551218/' },
    { name: 'Javeria Ejaz',           url: 'https://www.linkedin.com/in/javeria-ejaz-794238201/' },
    { name: 'Kanza Sohail',           url: 'https://www.linkedin.com/in/kanza-sohail-3a3491329/' },
    { name: 'Maria Asghar',           url: 'https://www.linkedin.com/in/maria-asghar-4172b4214/' },
    { name: 'Maryam Jamal',           url: 'https://www.linkedin.com/in/maryam-jamal-287b3728a/' },
    { name: 'Shafia Hameed',          url: 'https://www.linkedin.com/in/shafia-hameed-khan-b4487a200/' },
    { name: 'Zainab Rauf',            url: 'https://www.linkedin.com/in/zainab-rauf-3a9a70210/' },
    { name: 'Warisha Musharraf',      url: 'https://www.linkedin.com/in/warisha-musharraf-841457214/' },
    { name: 'Sara Khan',              url: 'https://www.linkedin.com/in/sara-khan-972352230/' },
    { name: 'Nawal Afaq',             url: 'https://www.linkedin.com/in/nawal-afaq-365b93225/' },
    { name: 'Sohema Anwar',           url: 'https://www.linkedin.com/in/sohema-anwar-19370a261/' },
    // Batch 2019
    { name: 'Batool Ehsan',           url: 'https://www.linkedin.com/in/batool-ehsan-16a26a198/' },
    { name: 'Afifa Fatima',           url: 'https://www.linkedin.com/in/afifa-fatima-151182182/' },
    { name: 'Amna Zubair',            url: 'https://www.linkedin.com/in/amna-zubair-849a5b192/' },
    { name: 'Areeba Nadeem',          url: 'https://www.linkedin.com/in/areeba-nadeem-/' },
    { name: 'Esha Imran',             url: 'https://www.linkedin.com/in/esha-imran/' },
    { name: 'Fatima Hussain',         url: 'https://www.linkedin.com/in/hfatima08/' },
    { name: 'Habiba Noushad',         url: 'https://www.linkedin.com/in/habiba-naushad/' },
    { name: 'Habiba Naushad',         url: 'https://www.linkedin.com/in/habiba-naushad/' },
    { name: 'Maryam Abdul Razzaq',    url: 'https://www.linkedin.com/in/maryam-abdul-razzak-86a274182/' },
    { name: 'Maryam Abdul Razzak',    url: 'https://www.linkedin.com/in/maryam-abdul-razzak-86a274182/' },
    { name: 'Misbah Fakhruj Farooqui',url: 'https://www.linkedin.com/in/misbah-fakhruj-19102a195/' },
    { name: 'Rabbiya Arif',           url: 'https://www.linkedin.com/in/rabbiya-arif/' },
    { name: 'Rumaisa Dilshad',        url: 'https://www.linkedin.com/in/rumaisa-dilshad-792419213/' },
    { name: 'Saleha Khan',            url: 'https://www.linkedin.com/in/saleha-khan-5956251b9/' },
    { name: 'Tarooba Faheem',         url: 'https://www.linkedin.com/in/tarooba-faheem-hussain/' },
    { name: 'Tehreem Fatima',         url: 'https://www.linkedin.com/in/t4tehreemfatima/' },
    { name: 'Urooj Nadeem',           url: 'https://www.linkedin.com/in/urooj-nadeem/' },
    { name: 'Wajiha Fatima',          url: 'https://www.linkedin.com/in/wajihafatima022001/' },
    { name: 'Zehra Aslam',            url: 'https://www.linkedin.com/in/zehra-aslam-97b42b20b/' },
    { name: 'Sana Nizam',             url: 'https://www.linkedin.com/in/sana-nizam-59537621a/' },
    { name: 'Laiba Nasir',            url: 'https://www.linkedin.com/in/laibanasir/' },
    { name: 'Safa Khalid',            url: 'https://www.linkedin.com/in/safa-khalid-836867223/' },
    // Batch 2018
    { name: 'Maryam Ashfaq',          url: 'https://www.linkedin.com/in/maryam-ashfaq-936bb91b3/' },
    { name: 'Hijab Zainab',           url: 'https://www.linkedin.com/in/hijab-zainab-165839133/' },
    { name: 'Jaweria Imran',          url: 'https://www.linkedin.com/in/jaweria-imran/' },
    { name: 'Aqsa Khan',              url: 'https://www.linkedin.com/in/aqsa-khan-794370225/' },
    { name: 'Roshanay Rahat',         url: 'https://www.linkedin.com/in/roshanay-rahat/' },
    { name: 'Aqsa Noor',              url: 'https://www.linkedin.com/in/aqsa-noor-2a172a180/' },
    { name: 'Asia Iqbal',             url: 'https://www.linkedin.com/in/asia-iqbal-71ab731a2/' },
    { name: 'Soha Mubashir',          url: 'https://www.linkedin.com/in/soha-mubashir-196r/' },
    { name: 'Shafaq Yameen',          url: 'https://www.linkedin.com/in/shafaq-n/' },
    { name: 'Neha Salahuddin',        url: 'https://www.linkedin.com/in/neha-khan-573958221/' },
    { name: 'Izba Shahid',            url: 'https://www.linkedin.com/in/izba/' },
    { name: 'Basra Arshad',           url: 'https://www.linkedin.com/in/basra-arshad-1964951a0/' },
    { name: 'Aiman Khalid',           url: 'https://www.linkedin.com/in/aimankhalid189/' },
    { name: 'Urooj Amjad',            url: 'https://www.linkedin.com/in/urooj-amjad-72812119b/' },
    { name: 'Tahreem Nazim',          url: 'https://www.linkedin.com/in/tahreem-nazim/' },
    { name: 'Tabia Naseer',           url: 'https://www.linkedin.com/in/tabia-naseer-154687180/' },
    { name: 'Syeda Warda Arshad',     url: 'https://www.linkedin.com/in/syeda-warda-arshad-00ab681b0/' },
    { name: 'Wajiha Rehman',          url: 'https://www.linkedin.com/in/wajiha-rehman-515031200/' },
    { name: 'Mizma Jawaid',           url: 'https://www.linkedin.com/in/mizma-jawaid-705889178/' },
    { name: 'Sarah Tariq',            url: 'https://www.linkedin.com/in/sarah-tariq-a6ab40213/' },
    { name: 'Maham Imrani',           url: 'https://www.linkedin.com/in/maham-imrani-4b11b71ba/' },
    { name: 'Javeria Ali',            url: 'https://www.linkedin.com/in/javeria-alii/' },
    { name: 'Hira Raees Khan',        url: 'https://www.linkedin.com/in/hira-raees-khan-8b6263211/' },
    { name: 'Abeera Afridi',          url: 'https://www.linkedin.com/in/abeera-afridi/' },
    { name: 'Fatima-tul-Zehra',       url: 'https://www.linkedin.com/in/fatima-tul-zehra-muhammad-kamil-1b006720b/' },
    { name: 'Yumna Khalid',           url: 'https://www.linkedin.com/in/yumna-khalid-8638a820b/' },
    { name: 'Syeda Mehak Abbas',      url: 'https://www.linkedin.com/in/mehak-abbas-bb067520b/' },
    // Batch 2017
    { name: 'Ghulam Sakina',          url: 'https://www.linkedin.com/in/ghulam-sakina/' },
    { name: 'Muskan Polani',          url: 'https://www.linkedin.com/in/muskan-polani-208a2874/' },
    { name: 'Namra Ali',              url: 'https://www.linkedin.com/in/namra-ali/' },
    { name: 'Fareena Imran',          url: 'https://www.linkedin.com/in/fareenaimran/' },
    { name: 'Rabiya Raheel',          url: 'https://www.linkedin.com/in/rabiya-raheel/' },
    { name: 'Aiman Tahir',            url: 'https://www.linkedin.com/in/rabiya-raheel/' },
    { name: 'Hira Lari',              url: 'https://www.linkedin.com/in/hira-lari-508414167/' },
    { name: 'Safia Anwar',            url: 'https://www.linkedin.com/in/safia-anwar-184699142/' },
    { name: 'Hafsa Habib',            url: 'https://www.linkedin.com/in/hafsahabib/' },
    { name: 'Sameen Choudhry',        url: 'https://www.linkedin.com/in/sameenchoudhry1/' },
    { name: 'Neha Ali',               url: 'https://www.linkedin.com/in/neha-ali-418418172/' },
    { name: 'Areeba Jabeen',          url: 'https://www.linkedin.com/in/areeba-jabeen-86445913a/' },
    { name: 'Sabika Bashir',          url: 'https://www.linkedin.com/in/sabika-bashir-66ab1420a/' },
    { name: 'Hira Zahid',             url: 'https://www.linkedin.com/in/hira-zahid-9076aa199/' },
    { name: 'Nain Tara',              url: 'https://www.linkedin.com/in/nain-tara-463ab41a3/' },
    { name: 'Sadia Beyg',             url: 'https://www.linkedin.com/in/sadya-beyg-747260159/' },
    { name: 'Surayya Obaid',          url: 'https://www.linkedin.com/in/surayya-obaid-662b64137/' },
    { name: 'Anum Ilyas',             url: 'https://www.linkedin.com/in/anum-ilyas-zia/' },
    { name: 'Hiba Binte Tariq',       url: 'https://www.linkedin.com/in/hibabintetariq/' },
    // Batch 2016
    { name: 'Amna Arif',              url: 'https://www.linkedin.com/in/amna-arif44/' },
    { name: 'Hafsa Malik',            url: 'https://www.linkedin.com/in/hafsa-iqbal-malik/' },
    { name: 'Wajeeha Shah',           url: 'https://www.linkedin.com/in/syedawajeeha-shah/' },
    { name: 'Noreen Jamil',           url: 'https://www.linkedin.com/in/noreen-jamil-5230531ba/' },
    { name: 'Soha Younus',            url: 'https://www.linkedin.com/in/sohayounus/' },
    { name: 'Erum Sulayman',          url: 'https://www.linkedin.com/in/erum-sulayman-495094127/' },
    { name: 'Natasha Wasim',          url: 'https://www.linkedin.com/in/natasha-wasim-300a281b5/' },
    { name: 'Iqra Akram',             url: 'https://www.linkedin.com/in/iqra-akram-sqa/' },
    { name: 'Syeda Hamna',            url: 'https://www.linkedin.com/in/syeda-hamna-bibi/' },
    { name: 'Hamna Sameen Rafique',   url: 'https://www.linkedin.com/in/areeba-k-a982491b3/' },
    { name: 'Areeba Khalid',          url: 'https://www.linkedin.com/in/areeba-k-a982491b3/' },
    { name: 'Umaima Ehtisham',        url: 'https://www.linkedin.com/in/umaimaehtisham/' },
    { name: 'Zara Saleem',            url: 'https://www.linkedin.com/in/zara-saleem/' },
    { name: 'Arifa Shamim',           url: 'https://www.linkedin.com/in/arifa-shamim-369aa81a3/' },
    // Batch 2015
    { name: 'Syeda Mariam Mehdi',     url: 'https://www.linkedin.com/in/syeda-mariam-mehdi-8a1807141/' },
    { name: 'Bushra Rehmani',         url: 'https://www.linkedin.com/in/rahmani-bushra-7a5092118/' },
    { name: 'Rabiya Rafique',         url: 'https://www.linkedin.com/in/rabiya-rafique-482464116/' },
    { name: 'Uneeba Anwar',           url: 'https://www.linkedin.com/in/uneeba-anwer-7a5180108/' },
    { name: 'Uneeba Anwer',           url: 'https://www.linkedin.com/in/uneeba-anwer-7a5180108/' },
    { name: 'Sobia Qamar',            url: 'https://www.linkedin.com/in/sobia-qamar-9a5b22116/' },
    { name: 'Dure Shahwar',           url: 'https://www.linkedin.com/in/dur-e-shahwar-lodhi-42285a130/' },
    { name: 'Maham Rahim',            url: 'https://www.linkedin.com/in/maham-rahim/' },
    { name: 'Amna Abdul Ghani',       url: 'https://www.linkedin.com/in/amna-abdul-ghani-896a2113b/' },
    { name: 'Mehwish Naseem',         url: 'https://www.linkedin.com/in/mahwish-naseem/' },
    { name: 'Mahwish Naseem',         url: 'https://www.linkedin.com/in/mahwish-naseem/' },
    { name: 'Sania Shoaib',           url: 'https://www.linkedin.com/in/sania-shoaib-565848154/' },
    { name: 'Maria AbuBakar',         url: 'https://www.linkedin.com/in/maria-abubakar-04308214b/' },
    { name: 'Maria Abu Bakar',        url: 'https://www.linkedin.com/in/maria-abubakar-04308214b/' },
    { name: 'Rameesha Tariq',         url: 'https://www.linkedin.com/in/rameesha-tariq-6a3b08130/' },
    { name: 'Bisha Shoaib',           url: 'https://www.linkedin.com/in/bisha-shoaib-063493155/' },
    { name: 'Noor UL Ain',            url: 'https://www.linkedin.com/in/noor-ul-ain-133348122/' },
    { name: 'Noor ul Ain',            url: 'https://www.linkedin.com/in/noor-ul-ain-133348122/' },
    { name: 'Urooba Umar',            url: 'https://www.linkedin.com/in/urooba-umar-7b8143154/' },
    { name: 'Ayesha Kaleem',          url: 'https://www.linkedin.com/in/ayesha-kaleem-015187b0/' },
    { name: 'Muniba Bukhari',         url: 'https://www.linkedin.com/in/muniba-bukhari-411100b6/' },
    { name: 'Rida Amir',              url: 'https://www.linkedin.com/in/rida-amir-b76299144/' },
    { name: 'Hira Iqra',              url: 'https://www.linkedin.com/in/hira-iqra-ajaz-9162b8102/' },
    { name: 'Rabia Nisar',            url: 'https://www.linkedin.com/in/rabia-nisar-13424a104/' },
    { name: 'Juwairiah Sheikh',       url: 'https://www.linkedin.com/in/juwairiah-sheikh/' },
    { name: 'Shifa Binte Tariq',      url: 'https://www.linkedin.com/in/shifa-binte-tariq-53518b108/' },
    { name: 'Aisha Aqeel',            url: 'https://www.linkedin.com/in/aaisha-aqeel-518b1611b/' },
    { name: 'Sundus Latif',           url: 'https://www.linkedin.com/in/sundus-latif-99584a110/' },
    { name: 'Kashaf Naz',             url: 'https://www.linkedin.com/in/kashaf-naz-ba2337139/' },
    { name: 'Fakhya Israr',           url: 'https://www.linkedin.com/in/fakhya-israr-77003a130/' },
    // Batch 2014
    { name: 'Ayesha Mukhtar',         url: 'https://www.linkedin.com/in/ayesha-mukhtar-671b47a0/' },
    { name: 'Marium Mateen',          url: 'https://www.linkedin.com/in/marium-mateen-b7a40080/' },
    { name: 'Maida Ahtesham',         url: 'https://www.linkedin.com/in/maida-ahtesham/' },
    { name: 'Shiza Anas',             url: 'https://www.linkedin.com/in/sheeza-anas-1207a493/' },
    { name: 'Sheeza Anas',            url: 'https://www.linkedin.com/in/sheeza-anas-1207a493/' },
    { name: 'Qurat-ul-Ain Khan',      url: 'https://www.linkedin.com/in/qurat-khan-291033105/' },
    { name: 'Quratul Ain Khan',       url: 'https://www.linkedin.com/in/qurat-khan-291033105/' },
    { name: 'Saba Sadiq',             url: 'https://www.linkedin.com/in/saba-sadiq-a8a614142/' },
    { name: 'Yamna Khalil',           url: 'https://www.linkedin.com/in/yamna-khalil-973801106/' },
    { name: 'Khadija Nawazish',       url: 'https://www.linkedin.com/in/khadijanawazish/' },
    { name: 'Ghazal Jabeen',          url: 'https://www.linkedin.com/in/ghazal-jabeen-704453105/' },
    { name: 'Hafiza Sarah Nazir',     url: 'https://www.linkedin.com/in/hafiza-sarah-nazir-210604/' },
    { name: 'Sarah Nazir',            url: 'https://www.linkedin.com/in/hafiza-sarah-nazir-210604/' },
    { name: 'Mariam Rizwan',          url: 'https://www.linkedin.com/in/maryam-r-395819136/' },
    { name: 'Maryam Rizwan',          url: 'https://www.linkedin.com/in/maryam-r-395819136/' },
    { name: 'Kanwal Siddiqui',        url: 'https://www.linkedin.com/in/kanwal-siddiqui-507182175/' },
    { name: 'Sadia Arshad',           url: 'https://www.linkedin.com/in/saadiaaarshad/' },
    { name: 'Zubia Kayani',           url: 'https://www.linkedin.com/in/zubiakayani/' },
    { name: 'Maha Khan',              url: 'https://www.linkedin.com/in/maha-khan-1396a3b7/' },
    // Batch 2013
    { name: 'Wafa Naz',               url: 'https://www.linkedin.com/in/syeda-wafa-naz-782984b6/' },
    { name: 'Syeda Wafa Naz',         url: 'https://www.linkedin.com/in/syeda-wafa-naz-782984b6/' },
    { name: 'Warda Majid',            url: 'https://www.linkedin.com/in/warda-majid-8a66377a/' },
    { name: 'Salma Nazeer Khan',      url: 'https://www.linkedin.com/in/2006b7aa/' },
    { name: 'Alishba Muhammad Anwer', url: 'https://www.linkedin.com/in/alishba-anwer-698851264/' },
    { name: 'Alishba Anwer',          url: 'https://www.linkedin.com/in/alishba-anwer-698851264/' },
    { name: 'Hamna Hashmi',           url: 'https://www.linkedin.com/in/hamna-hashmi-0795467a/' },
    { name: 'Neha Noor',              url: 'https://www.linkedin.com/in/neha-noor-64b28082/' },
    { name: 'Erum Shafiq',            url: 'https://www.linkedin.com/in/erumshafiq/' },
    { name: 'Ramsha Ansari',          url: 'https://www.linkedin.com/in/ramsha-ansari-440301107/' },
    { name: 'Shanza Khan',            url: 'https://www.linkedin.com/in/shanza-khan-8b740b114/' },
    { name: 'Syeda Lyla Zehra',       url: 'https://www.linkedin.com/in/syeda-lyla-zahra-12a619110/' },
    { name: 'Lyla Zehra',             url: 'https://www.linkedin.com/in/syeda-lyla-zahra-12a619110/' },
    { name: 'Rida Afroz',             url: 'https://www.linkedin.com/in/rida-afroz-2b23337a/' },
    // Batch 2012
    { name: 'Amsa Ashfaq',            url: 'https://www.linkedin.com/in/amsa-ashfaq-8313371a3/' },
    { name: 'Maria Rahman',           url: 'https://www.linkedin.com/in/maria-rahman-8979a393/' },
    { name: 'Sara Afaq',              url: 'https://www.linkedin.com/in/sarah-afaq/' },
    { name: 'Sarah Afaq',             url: 'https://www.linkedin.com/in/sarah-afaq/' },
    { name: 'Rizwana Saeed',          url: 'https://www.linkedin.com/in/rizwana-saeed-3856607a/' },
    { name: 'Maha Adil',              url: 'https://www.linkedin.com/in/mahaadil/' },
    { name: 'Samouna Jawed',          url: 'https://www.linkedin.com/in/samouna-jawed-69a54b7b/' },
    { name: 'Maha Shakeel',           url: 'https://www.linkedin.com/in/maha-shakeel-285b127a/' },
    { name: 'Fizza Aftab',            url: 'https://www.linkedin.com/in/fizza-aftab-401531186/' },
    { name: 'Asna Shahid',            url: 'https://www.linkedin.com/in/asna-shahid-21b3608a/' },
    { name: 'Fareha Nadeem',          url: 'https://www.linkedin.com/in/fareha-nadeem/' },
    { name: 'Bushra Waseem',          url: 'https://www.linkedin.com/in/bushra-waseem-29b0691a7/' },
    { name: 'Mona Asghar',            url: 'https://www.linkedin.com/in/mona-asghar-328705185/' },
    { name: 'Maha Anjum',             url: 'https://www.linkedin.com/in/maha-anjum-7381b748/' },
    { name: 'Kiran Atta',             url: 'https://www.linkedin.com/in/kiran-atta-93756693/' },
    { name: 'Tehreem Qamar',          url: 'https://www.linkedin.com/in/tehreemqamar/' },
    { name: 'Abira Khan',             url: 'https://www.linkedin.com/in/abira-khan-61012486/' },
    { name: 'Tabia Rahid',            url: 'https://www.linkedin.com/in/tabia-rashid-a42738202/' },
    { name: 'Tabia Rashid',           url: 'https://www.linkedin.com/in/tabia-rashid-a42738202/' },
    // Batch 2011
    { name: 'Sarah Fatima',           url: 'https://www.linkedin.com/in/sarah-fatima-istqb-ctfl-certified-38821464/' },
    { name: 'Sara Fatima',            url: 'https://www.linkedin.com/in/sarah-fatima-istqb-ctfl-certified-38821464/' },
    { name: 'Hera Ruksheen',          url: 'https://www.linkedin.com/in/hera-fahad/' },
    { name: 'Sidra Zafar',            url: 'https://www.linkedin.com/in/sidra-zafar-siddiqui-0b01a973/' },
    { name: 'Amna Jalal',             url: 'https://www.linkedin.com/in/amnajalal/' },
    { name: 'Ramsha Arif',            url: 'https://www.linkedin.com/in/ramsha-ahsan/' },
    { name: 'Tehreem Saeed',          url: 'https://www.linkedin.com/in/tehreem-saeed-217582b6/' },
    { name: 'Rabia Ahmed',            url: 'https://www.linkedin.com/in/rabia-ahmed-24347663/' },
    { name: 'Raneem Rashid',          url: 'https://www.linkedin.com/in/raneem-r-94025a69/' },
    { name: 'Farah Rehman',           url: 'https://www.linkedin.com/in/frfarahrahman/' },
    { name: 'Sidrah Abdullah',        url: 'https://www.linkedin.com/in/hsabdullah/' },
    { name: 'Sidra Abdullah',         url: 'https://www.linkedin.com/in/hsabdullah/' },
    { name: 'Sidra Laeeq',            url: 'https://www.linkedin.com/in/sidra-laeeq-972b1a58/' },
    { name: 'Kanwal Zahoor',          url: 'https://www.linkedin.com/in/kanwal-zahoor-074412b2/' },
    // Batch 2010
    { name: 'Asma Ghori',             url: 'https://www.linkedin.com/in/asmakhanghori/' },
    { name: 'Hamna Khan',             url: 'https://www.linkedin.com/in/hamna-khan-b26b5186/' },
    { name: 'Ayman Haseen',           url: 'https://www.linkedin.com/in/ayman-haseen-084296b3/' },
    // Batch 2009
    { name: 'Sidra Urooj',            url: 'https://www.linkedin.com/in/sidra-urooj-b386baa9/' },
    { name: 'Ramsha Lodhi',           url: 'https://www.linkedin.com/in/ramsha-lodhi-44b1404b/' },
    // Batch 2008
    { name: 'Zainab Owais',           url: 'https://www.linkedin.com/in/zainab-owais/' },
    { name: 'Shahzeena Khan',         url: 'https://www.linkedin.com/in/shahzeena-khan-a5462256/' },
    { name: 'Syeda Ayeisha Zamani',   url: 'https://www.linkedin.com/in/syeda-ayeisha-zamani-3233522a/' },
    { name: 'Ayeisha Zamani',         url: 'https://www.linkedin.com/in/syeda-ayeisha-zamani-3233522a/' },
    { name: 'Tooba Jamal',            url: 'https://www.linkedin.com/in/tooba-jamal-59656a59/' },
    { name: 'Husne Ara Asma',         url: 'https://www.linkedin.com/in/husne-ara-asma/' },
    { name: 'Alefya Murtaza',         url: 'https://www.linkedin.com/in/alefya-murtaza-9906a7117/' },
    { name: 'Hina Siddiqui',          url: 'https://www.linkedin.com/in/hina-siddiqui-a681063a/' },
    { name: 'Aisha Owais',            url: 'https://www.linkedin.com/in/aisha-owais-61729530/' },
    // Batch 2007
    { name: 'Samina Shareef',         url: 'https://www.linkedin.com/in/samina-sharif-9a34994a/' },
    { name: 'Samina Sharif',          url: 'https://www.linkedin.com/in/samina-sharif-9a34994a/' },
    { name: 'Madeeha Rehman',         url: 'https://www.linkedin.com/in/madiha-rehman-49403b21/' },
    { name: 'Madiha Rehman',          url: 'https://www.linkedin.com/in/madiha-rehman-49403b21/' },
    { name: 'Soomaiya Hamid',         url: 'https://www.linkedin.com/in/soomaiya-hamid/' },
    // Batch 2006
    { name: 'Maheen Babar',           url: 'https://www.linkedin.com/in/maheen-babar-87255a159/' },
    { name: 'Humera Haroon',          url: 'https://www.linkedin.com/in/humera-haroon-bb288421/' },
    { name: 'Ramsha Ali',             url: 'https://www.linkedin.com/in/ramshaali/' },
    // Batch 2004
    { name: 'Hafsa Saadat',           url: 'https://www.linkedin.com/in/hafsa-saadat/' },
    { name: 'Nazish Nouman',          url: 'https://www.linkedin.com/in/nazish-nouman-19a275a/' },
    // Batch 2002
    { name: 'Misbah Jamil',           url: 'https://www.linkedin.com/in/misbah-jamil-975baa28/' },
    { name: 'Sana Qadir',             url: 'https://www.linkedin.com/in/sana-qadir-82802b59/' },
    { name: 'Hira Mannan',            url: 'https://www.linkedin.com/in/hiramannan/' },
    // Batch 2001
    { name: 'Shahla Abbas',           url: 'https://www.linkedin.com/in/shahla-abbas/' },
    // Batch 2000
    { name: 'Erum Mirza',             url: 'https://www.linkedin.com/in/erummirza/' },
    { name: 'Tabassum Wajid',         url: 'https://www.linkedin.com/in/tabassum-wajid/' },
    { name: 'Nargis Anjaria',         url: 'https://www.linkedin.com/in/nargis-anjaria-2b173a95/' },
    { name: 'Faiza Ateeq',            url: 'https://www.linkedin.com/in/faiza-ateeq-69911a1b/' },
    { name: 'Saboohi Naeem',          url: 'https://www.linkedin.com/in/saboohi-mahmood-64b5b26a/' },
];

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas\n');

    // Load all alumni from DB once
    const allAlumni = await mongoose.connection.db.collection('users')
        .find({ role: 'alumni' }, { projection: { _id: 1, name: 1 } })
        .toArray();

    console.log(`📋 Found ${allAlumni.length} alumni in database\n`);

    // Build normalized name → _id map
    const dbMap = new Map();
    for (const a of allAlumni) {
        dbMap.set(norm(a.name), a._id);
    }

    // Deduplicate: if same name appears multiple times in alumniData, last wins
    const deduped = new Map();
    for (const a of alumniData) {
        deduped.set(norm(a.name), { original: a.name, url: a.url });
    }

    let updated = 0, notFound = 0;
    const stillMissing = [];

    for (const [normalizedKey, { original, url }] of deduped) {
        const cleanedUrl = cleanUrl(url);
        const dbId = dbMap.get(normalizedKey);

        if (dbId) {
            await mongoose.connection.db.collection('users').updateOne(
                { _id: dbId },
                { $set: { linkedIn: cleanedUrl } }
            );
            updated++;
        } else {
            // Try partial match: first two words of normalized name
            const words = normalizedKey.split(' ').filter(Boolean);
            const partial = words.slice(0, 2).join(' ');
            let matched = null;
            for (const [dbKey, dbId2] of dbMap) {
                if (dbKey.includes(partial) || partial.split(' ').every(w => dbKey.includes(w))) {
                    matched = { key: dbKey, id: dbId2 };
                    break;
                }
            }
            if (matched) {
                await mongoose.connection.db.collection('users').updateOne(
                    { _id: matched.id },
                    { $set: { linkedIn: cleanedUrl } }
                );
                updated++;
                console.log(`✓  Fuzzy match: "${original}" → DB name matched`);
            } else {
                notFound++;
                stillMissing.push(original);
            }
        }
    }

    console.log(`\n✅ Done!`);
    console.log(`   Updated : ${updated}`);
    console.log(`   Not found: ${notFound}`);

    if (stillMissing.length) {
        console.log('\n--- Still missing (check spelling in DB) ---');
        stillMissing.forEach(n => console.log(' •', n));
    }

    await mongoose.disconnect();
}

run().catch(console.error);
