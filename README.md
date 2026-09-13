![](https://github.com/thecodingmachine/workadventure/workflows/Continuous%20Integration/badge.svg) [![Discord](https://img.shields.io/discord/821338762134290432?label=Discord)](https://discord.gg/G6Xh9ZM9aR) ![Awesome](https://awesome.re/badge.svg)

![WorkAdventure office image](README-MAP.png)

# NG Academy — أكاديمية الجيل الجديد 🦉

> **هذا المستودع نسخة محوّلة من WorkAdventure إلى مدرسة افتراضية آمنة وممتعة
> للأطفال (6–12 سنة).** المحرك لم يُعَد بناؤه — بُني فوقه «العقل الأكاديمي»:
> عالم مدرسة بـ13 خريطة، البومة المرشدة **جينو**، صفوف وشارات مشجعة، أمان صارم
> للطفل، بوابة لولي الأمر/المعلم/الإدارة، وAPI أكاديمي كامل.

| المكوّن         | المكان                                                 | الدور                                                                                         |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| عالم الطفل      | ‏`play/` (المحرك الأصلي) + `play/src/front/NgAcademy/` | العالم هو الصفحة الرئيسية للطفل: جينو، الفقاعات، صف الاصطفاف، الاحتفال بالشارات               |
| خرائط المدرسة   | ‏`maps/ng-academy/`                                    | مدخل + 7 فصول + مكتبة + مختبر + مسرح + قاعة إبداع + قاعة إنجازات (مولَّدة بسكربت، 181KB كلها) |
| ‏API الأكاديمية | ‏`ng-academy-api/`                                     | Admin API لـWorkAdventure + رابط سحري + أدوار + حضور صامت + أنشطة/شارات + مسارات البوابة      |
| بوابة الكبار    | ‏`ng-academy-portal/`                                  | ولي الأمر/المعلم/الإدارة — تصميم تقليدي منفصل تمامًا عن واجهة الطفل (~24KB)                   |
| الهوية والأصول  | ‏`brand/`, `play/public/static/images/ng/`             | الشعار، جينو، الألوان (#38b6ff)، أفاتارات كرتونية فقط                                         |

**التوثيق (عربي):** ‏[خطة التحويل والفحص](NG-ACADEMY-خطة-التحويل.md) •
‏[سجل التنفيذ والمراحل](NG-ACADEMY-progress.md) •
‏[تشغيل بيئة التطوير](docs/agent/dev-setup.md)

**تشغيل سريع (تطوير):** ‏`./bootstrap.sh` ثم `docker compose up -d` — العالم على
‏`play.workadventure.localhost`، والـAPI على `ng-api.workadventure.localhost`، وبوابة
الكبار على `ng-portal.workadventure.localhost/portal/` (جرّب
‏`npm run dev:memory --workspace ng-academy-api` لتجربة الرابط السحري بلا Postgres).
**الإنتاج:** ‏`docker compose -f docker-compose.yaml -f docker-compose.ng-production.yaml up -d`
(انظر رأس ملف الـoverlay للمتغيرات المطلوبة).

---

# WorkAdventure

WorkAdventure is a platform that allows you to design **fully customizable collaborative virtual worlds** (metaverse).

With your own avatar, you can **interact spontaneously** with your colleagues, clients, partners (using a **video-chat system**, triggered when you approach someone).
Imagine **all types of immersive experiences** (recruitments, onboarding, trainings, digital workplace, internal/external events) on desktop, mobile or tablet.

_The little plus? The platform is **GDPR** and **open source**!_

**See more features for your [virtual office](https://workadventu.re/virtual-offices/virtual-meetings/?utm_source=github)!**

**Pricing for our [SaaS version](https://workadventu.re/pricing/?utm_source=github)!**

[![Workadventure live demo example](https://workadventu.re/wp-content/uploads/2024/02/Button-Live-Demo.png)](https://play.staging.workadventu.re/@/tcm/workadventure/wa-village/?utm_source=github)
[![Workadventure Website](https://workadventu.re/wp-content/uploads/2024/02/Button-Website.png)](https://workadventu.re/?utm_source=github)

###### Support our team!

[![Discord Logo](https://workadventu.re/wp-content/uploads/2024/02/Icon-Discord.png)](https://discord.com/invite/G6Xh9ZM9aR)
[![X Social Logo](https://workadventu.re/wp-content/uploads/2024/02/Icon-X.png)](https://twitter.com/Workadventure_)
[![LinkedIn Logo](https://workadventu.re/wp-content/uploads/2024/02/Icon-LinkedIn.png)](https://www.linkedin.com/company/workadventu-re/)

![Stats repo](https://github-readme-stats.vercel.app/api?username={username}&theme=transparent)

## Community resources

1. Want to build your own map, check out our **[map building documentation](https://docs.workadventu.re/map-building/)**
2. Check out resources developed by the WorkAdventure community at **[awesome-workadventure](https://github.com/workadventure/awesome-workadventure)**

## Setting up a production environment

We support 2 ways to set up a production environment:

- using Docker Compose
- or using a Helm chart for Kubernetes

Please check the [Setting up a production environment](docs/others/self-hosting/install.md) guide for more information.

> [!NOTE]
> WorkAdventure also provides a [hosted version](https://workadventu.re/?utm_source=github) of the application. Using the hosted version is
> the easiest way to get started and helps us to keep the project alive.

## Setting up a development environment

> [!NOTE]
> These installation instructions are for local development only. They will not work on
> remote servers as local environments do not have HTTPS certificates.

Install Docker and clone this repository.

> [!WARNING]
> If you are using Windows, make sure the End-Of-Line character is not modified by the cloning process by setting
> the `core.autocrlf` setting to false: `git config --global core.autocrlf false`

Run:

```
cp .env.template .env
docker-compose up
```

The environment will start with the OIDC mock server enabled by default.

You should now be able to browse to http://play.workadventure.localhost/ and see the application.
You can view the Traefik dashboard at http://traefik.workadventure.localhost

(Test user is "User1" and password is "pwd")

If you want to disable the OIDC mock server (for anonymous access), you can run:

```console
$ docker-compose -f docker-compose.yaml -f docker-compose-no-oidc.yaml up
```

Note: on some OSes, you will need to add this line to your `/etc/hosts` file:

**/etc/hosts**

```
127.0.0.1 oidc.workadventure.localhost redis.workadventure.localhost play.workadventure.localhost traefik.workadventure.localhost matrix.workadventure.localhost extra.workadventure.localhost icon.workadventure.localhost map-storage.workadventure.localhost uploader.workadventure.localhost maps.workadventure.localhost api.workadventure.localhost front.workadventure.localhost
```

### Troubleshooting

See our [troubleshooting guide](docs/others/troubleshooting.md).
