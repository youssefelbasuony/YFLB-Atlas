(() => {
  const DATA = window.AtlasData;
  if (!DATA) return;

  const parseTitle = (value) => {
    const [en, ar] = value.split("::");
    return { en: en.trim(), ar: ar.trim() };
  };
  const parseModule = ([name, labels]) => ({
    title: parseTitle(name),
    topics: labels.split("|").map((label) => ({ title: parseTitle(label) }))
  });
  const focusTracks = {
    communication: [
      ["Audience, purpose and context::الجمهور والغرض والسياق", "Audience and stakeholder needs::احتياجات الجمهور وأصحاب المصلحة|Communication goals and outcomes::أهداف التواصل ونتائجه|Channels and message design::القنوات وتصميم الرسائل|Culture, access and context::الثقافة والإتاحة والسياق"],
      ["Communication methods and practice::أساليب التواصل والتطبيق", "Listening and dialogue practice::تطبيقات الاستماع والحوار|Writing and presentation methods::أساليب الكتابة والعرض|Feedback, negotiation and influence::التغذية الراجعة والتفاوض والتأثير|Evaluate clarity and understanding::تقييم الوضوح والفهم"]
    ],
    psychology: [
      ["Concepts, theories and evidence::المفاهيم والنظريات والأدلة", "Core concepts and definitions::المفاهيم والتعريفات الأساسية|Major theories and models::النظريات والنماذج الرئيسية|Research questions and evidence::الأسئلة البحثية والأدلة|Individual, social and cultural context::السياق الفردي والاجتماعي والثقافي"],
      ["Methods, applications and ethical boundaries::الأساليب والتطبيقات والحدود الأخلاقية", "Observation and measurement::الملاحظة والقياس|Research methods and interpretation::مناهج البحث والتفسير|Applications in everyday and work settings::التطبيقات في الحياة والعمل|Ethical practice and limits of inference::الممارسة الأخلاقية وحدود الاستدلال"]
    ],
    people: [
      ["Foundations and workplace context::الأسس وسياق العمل", "Roles, expectations and relationships::الأدوار والتوقعات والعلاقات|Motivation and individual differences::الدافعية والفروق الفردية|Team, culture and organization::الفريق والثقافة والمنظمة|Evidence and fair practice::الأدلة والممارسة العادلة"],
      ["Skills practice and professional application::تطبيق المهارات والممارسة المهنية", "Coaching and feedback::التوجيه والتغذية الراجعة|Collaboration and conflict::التعاون والخلاف|Goals, performance and growth::الأهداف والأداء والنمو|Ethics, inclusion and reflection::الأخلاقيات والشمول والتأمل"]
    ],
    product: [
      ["Product discovery and direction::استكشاف المنتج وتوجهه", "Customer problems and research::مشكلات العملاء والبحث|Market, alternatives and positioning::السوق والبدائل والتموضع|Product vision and outcomes::رؤية المنتج ونتائجه|Value proposition and business case::عرض القيمة ومبررات الأعمال"],
      ["Product delivery, launch and learning::تطوير المنتج وإطلاقه والتعلم منه", "Requirements and prioritization::المتطلبات وترتيب الأولويات|Design and engineering collaboration::التصميم والتعاون الهندسي|Go-to-market and launch::دخول السوق والإطلاق|Metrics, experiments and iteration::المقاييس والتجارب والتطوير التكراري"]
    ],
    engineering: [
      ["Technical direction and engineering systems::التوجه التقني والأنظمة الهندسية", "Architecture and system design::الهندسة وتصميم الأنظمة|Technical strategy and trade-offs::الاستراتيجية التقنية والمفاضلات|Quality, testing and technical debt::الجودة والاختبار والدين التقني|Reliability, security and scalability::الاعتمادية والأمن وقابلية التوسع"],
      ["Team leadership and delivery::قيادة الفرق والتنفيذ", "Team structure, hiring and capability::هيكل الفريق والتوظيف والقدرات|Coaching, feedback and career growth::التوجيه والتغذية الراجعة والنمو المهني|Planning, dependencies and execution::التخطيط والاعتماديات والتنفيذ|Incidents, stakeholders and learning::الحوادث وأصحاب المصلحة والتعلم"]
    ],
    data: [
      ["Data foundations and analysis workflow::أسس البيانات وسير التحليل", "Questions, measures and data sources::الأسئلة والمقاييس ومصادر البيانات|Cleaning and transformation::التنظيف والتحويل|Exploration and descriptive analysis::الاستكشاف والتحليل الوصفي|Statistical reasoning and uncertainty::الاستدلال الإحصائي وعدم اليقين"],
      ["Analytical methods and communication::الأساليب التحليلية والتواصل", "Visualization and dashboard design::تصميم التصور ولوحات المتابعة|Inference, prediction and experiments::الاستدلال والتنبؤ والتجارب|Interpretation and decision support::التفسير ودعم القرار|Privacy, reproducibility and presentation::الخصوصية وقابلية إعادة الإنتاج والعرض"]
    ],
    bi: [
      ["Business intelligence foundations::أسس ذكاء الأعمال", "Business questions and performance measures::أسئلة الأعمال ومقاييس الأداء|Data sources and governance::مصادر البيانات والحوكمة|Analytical models and metrics::النماذج التحليلية والمقاييس|Reporting needs and decision cycles::احتياجات التقارير ودورات القرار"],
      ["BI platforms, dashboards and adoption::منصات ذكاء الأعمال ولوحاته وتبنيه", "Warehouse and semantic design::تصميم المستودع والدلالات|Data preparation and refresh::إعداد البيانات وتحديثها|Dashboard usability and accessibility::سهولة لوحات المتابعة وإمكانية الوصول|Insight communication and adoption::عرض الرؤى وتبنيها"]
    ],
    python: [
      ["Python and analytical computing foundations::أسس بايثون والحوسبة التحليلية", "Environments, packages and notebooks::البيئات والحزم ودفاتر العمل|Types, functions and collections::الأنواع والدوال والمجموعات|Arrays and tabular data::المصفوفات والبيانات الجدولية|Files, formats and external sources::الملفات والتنسيقات والمصادر الخارجية"],
      ["Data preparation, analysis and visualization with Python::إعداد البيانات وتحليلها وتصويرها ببايثون", "Filtering, grouping and joining data::تصفية البيانات وتجميعها وربطها|Missing values and outliers::القيم المفقودة والقيم الشاذة|Statistics and exploratory analysis::الإحصاء والتحليل الاستكشافي|Charts, reports and reproducibility::الرسوم والتقارير وقابلية إعادة الإنتاج"]
    ],
    systems: [
      ["Technical concepts and architecture::المفاهيم التقنية والهندسة", "Architecture and system boundaries::الهندسة وحدود الأنظمة|Data, interfaces and integration::البيانات والواجهات والتكامل|Security and reliability::الأمن والاعتمادية|Lifecycle and operational context::دورة الحياة وسياق التشغيل"],
      ["Implementation, operations and evaluation::التنفيذ والتشغيل والتقييم", "Design and implementation methods::أساليب التصميم والتنفيذ|Testing and change control::الاختبار وضبط التغيير|Monitoring and troubleshooting::المراقبة وتشخيص الأعطال|Performance, risk and improvement::الأداء والمخاطر والتحسين"]
    ],
    database: [
      ["Database foundations and data structures::أسس قواعد البيانات وهياكلها", "Relational and non-relational models::النماذج العلائقية وغير العلائقية|Schemas, keys and constraints::المخططات والمفاتيح والقيود|Transactions and concurrency::المعاملات والتزامن|Storage, indexes and query plans::التخزين والفهارس وخطط الاستعلام"],
      ["Database operations and reliability::تشغيل قواعد البيانات واعتماديتها", "Installation and secure configuration::التثبيت والإعداد الآمن|Backup, restore and migration::النسخ والاستعادة والترحيل|Replication and availability::التكرار والتوافر|Monitoring, tuning and recovery::المراقبة والتحسين والتعافي"]
    ],
    business: [
      ["Domain foundations and stakeholders::أسس المجال وأصحاب المصلحة", "Core concepts and scope::المفاهيم الأساسية والنطاق|Participants and institutions::المشاركون والمؤسسات|Value, objectives and measures::القيمة والأهداف والمقاييس|Rules, risks and constraints::القواعد والمخاطر والقيود"],
      ["Methods, decisions and applied cases::الأساليب والقرارات والحالات التطبيقية", "Analysis and planning methods::أساليب التحليل والتخطيط|Tools and operating processes::الأدوات والعمليات التشغيلية|Decision-making and performance::اتخاذ القرار والأداء|Case review and responsible practice::مراجعة الحالات والممارسة المسؤولة"]
    ],
    operations: [
      ["Operations foundations and process context::أسس العمليات وسياق الإجراءات", "Customers, demand and service levels::العملاء والطلب ومستويات الخدمة|Processes, capacity and resources::العمليات والطاقة والموارد|Quality, variation and constraints::الجودة والتباين والقيود|Safety, suppliers and resilience::السلامة والموردون والمرونة"],
      ["Planning, improvement and applied operations::التخطيط والتحسين والعمليات التطبيقية", "Forecasts and schedules::التوقعات والجداول|Inventory and flow::المخزون والتدفق|Performance analysis and improvement::تحليل الأداء وتحسينه|Risk, sustainability and outcomes::المخاطر والاستدامة والنتائج"]
    ],
    applied: [
      ["Sector foundations and service context::أسس القطاع وسياق الخدمة", "Industry structure and participants::هيكل القطاع ومشاركوه|Users, customers and community::المستخدمون والعملاء والمجتمع|Services, operations and resources::الخدمات والعمليات والموارد|Regulations and professional roles::الأنظمة والأدوار المهنية"],
      ["Sector methods and measurable impact::أساليب القطاع والأثر القابل للقياس", "Finance, access and capacity::التمويل والوصول والطاقة الاستيعابية|Technology and data applications::تطبيقات التقنية والبيانات|Quality, safety and ethical practice::الجودة والسلامة والممارسة الأخلاقية|Outcome measures and improvement::مقاييس النتائج والتحسين"]
    ],
    professional: [
      ["Foundations and professional context::الأسس والسياق المهني", "Core concepts and purpose::المفاهيم الأساسية والغرض|People, roles and stakeholders::الأفراد والأدوار وأصحاب المصلحة|Methods and evidence::الأساليب والأدلة|Standards and ethical boundaries::المعايير والحدود الأخلاقية"],
      ["Practice, feedback and continuous development::التطبيق والتغذية الراجعة والتطور المستمر", "Skills practice and reflection::تطبيق المهارات والتأمل|Tools and repeatable workflows::الأدوات وسير العمل القابل للتكرار|Evaluation and improvement::التقييم والتحسين|Communication and responsible application::التواصل والتطبيق المسؤول"]
    ]
  };
  const supplementalTracks = {
    communication: [
      ["Conversation and listening practice::تطبيقات الحوار والاستماع", "Questioning and clarification::الأسئلة والتوضيح|Listening and paraphrasing::الاستماع وإعادة الصياغة|Empathy and perspective-taking::التعاطف وفهم وجهات النظر|Conversation flow and turn-taking::سير الحوار وتبادل الأدوار"],
      ["Writing, speaking and presentation::الكتابة والحديث والعرض", "Clear messages and plain language::الرسائل الواضحة واللغة المبسطة|Reports and executive summaries::التقارير والملخصات التنفيذية|Presentation structure and delivery::بناء العرض وتقديمه|Storytelling and visual explanation::السرد والشرح البصري"],
      ["Nonverbal and cross-cultural communication::التواصل غير اللفظي وعبر الثقافات", "Posture, gesture and movement::الوقفة والإيماءة والحركة|Face, gaze and vocal tone::الوجه والنظر ونبرة الصوت|Personal space and context::المساحة الشخصية والسياق|Cultural variation and inference limits::الاختلاف الثقافي وحدود الاستنتاج"],
      ["Conflict, feedback and high-stakes practice::الخلاف والتغذية الراجعة والمواقف الحساسة", "Specific feedback and follow-up::الملاحظات المحددة ومتابعتها|Conflict de-escalation::خفض تصعيد الخلاف|Negotiation preparation::الاستعداد للتفاوض|Crisis and incident updates::التواصل أثناء الأزمات والحوادث"]
    ],
    psychology: [
      ["Research design and psychological measurement::تصميم البحث والقياس النفسي", "Research questions and hypotheses::الأسئلة والفرضيات البحثية|Observation and experiments::الملاحظة والتجارب|Scales, reliability and validity::المقاييس والثبات والصدق|Ethics, consent and uncertainty::الأخلاقيات والموافقة وعدم اليقين"],
      ["Cognition, learning and decision::الإدراك والتعلم واتخاذ القرار", "Attention and perception::الانتباه والإدراك|Memory and recall::الذاكرة والاسترجاع|Learning and reinforcement::التعلم والتعزيز|Judgment, heuristics and bias::الحكم والاستدلال والتحيز"],
      ["Emotion, personality and social behavior::الانفعال والشخصية والسلوك الاجتماعي", "Motivation and goal pursuit::الدافعية والسعي للأهداف|Emotion and self-regulation::الانفعال وتنظيم الذات|Personality and individual differences::الشخصية والفروق الفردية|Social influence and group norms::التأثير الاجتماعي وأعراف الجماعة"],
      ["Workplace applications and ethical limits::تطبيقات العمل والحدود الأخلاقية", "Work design and human factors::تصميم العمل والعوامل البشرية|Team and leadership behavior::سلوك الفريق والقيادة|Wellbeing, stress and coping::الرفاه والضغط والتكيف|Responsible interpretation and referral::التفسير المسؤول والإحالة المختصة"]
    ],
    people: [
      ["Self-management and sustainable performance::إدارة الذات والأداء المستدام", "Self-awareness and reflection::الوعي بالذات والتأمل|Goals, focus and priorities::الأهداف والتركيز والأولويات|Stress and personal resilience::الضغط والمرونة الشخصية|Adaptability and continuous learning::المرونة والتعلم المستمر"],
      ["Relationships, collaboration and trust::العلاقات والتعاون والثقة", "Active listening and empathy::الاستماع الفعال والتعاطف|Team roles and working agreements::أدوار الفريق واتفاقات العمل|Trust and psychological safety::الثقة والأمان النفسي|Conflict and repair::الخلاف وإصلاح العلاقة"],
      ["Leadership, coaching and team growth::القيادة والتوجيه ونمو الفريق", "Coaching and developmental questions::التوجيه والأسئلة التطويرية|Feedback and recognition::التغذية الراجعة والتقدير|Delegation and accountability::التفويض والمساءلة|Career growth and mentoring::النمو المهني والإرشاد"],
      ["Inclusive and ethical workplace practice::الممارسة الشاملة والأخلاقية في العمل", "Inclusive team behaviors::سلوكيات الفريق الشامل|Fair and transparent decisions::القرارات العادلة والشفافة|Boundaries, confidentiality and care::الحدود والسرية والرعاية|Reflection and skill practice::التأمل وتطبيق المهارات"]
    ],
    engineering: [
      ["Architecture, technical strategy and trade-offs::الهندسة والاستراتيجية التقنية والمفاضلات", "System boundaries and architecture views::حدود الأنظمة ووجهات الهندسة|Build, buy and partner decisions::قرارات البناء والشراء والشراكة|Technical roadmaps and standards::خرائط الطريق والمعايير التقنية|Technical debt and modernization::الدين التقني والتحديث"],
      ["Software quality, testing and release practice::جودة البرمجيات والاختبار وممارسة الإصدار", "Code review and engineering standards::مراجعة الشيفرة والمعايير الهندسية|Test strategy and quality measures::استراتيجية الاختبار ومقاييس الجودة|Continuous delivery and releases::التسليم المستمر والإصدارات|Security and technical risk::الأمن والمخاطر التقنية"],
      ["Reliability, scale and incident response::الاعتمادية والتوسع والاستجابة للحوادث", "Performance and capacity planning::تخطيط الأداء والطاقة|Monitoring and service objectives::المراقبة وأهداف الخدمة|Incident command and communication::قيادة الحوادث والتواصل|Recovery, continuity and postmortems::التعافي والاستمرارية ومراجعات الحوادث"],
      ["Engineering teams, stakeholders and budgets::فرق الهندسة وأصحاب المصلحة والميزانيات", "Team topology and capability::أنماط الفرق والقدرات|Hiring, mentoring and career paths::التوظيف والإرشاد والمسارات المهنية|Planning, dependencies and resource forecasts::التخطيط والاعتماديات وتوقع الموارد|Executive alignment and business cases::مواءمة القيادات ومبررات الأعمال"]
    ],
    product: [
      ["Customer discovery and product evidence::استكشاف العملاء وأدلة المنتج", "Problem interviews and observation::مقابلات المشكلات والملاحظة|Market segments and trends::شرائح السوق واتجاهاته|Personas, journeys and jobs::شخصيات العملاء ورحلاتهم ومهامهم|Alternatives and value proposition::البدائل وعرض القيمة"],
      ["Product strategy and roadmap practice::استراتيجية المنتج وممارسة خارطة الطريق", "Vision, mission and outcomes::الرؤية والرسالة والنتائج|Market and competitive position::الموقع السوقي والتنافسي|Prioritization and trade-offs::ترتيب الأولويات والمفاضلات|Outcome-based roadmap::خارطة طريق مرتبطة بالنتائج"],
      ["Design and product delivery::التصميم وتسليم المنتج", "Prototyping and usability tests::النماذج الأولية واختبارات سهولة الاستخدام|Requirements and acceptance criteria::المتطلبات ومعايير القبول|Engineering collaboration and agile delivery::التعاون الهندسي والتنفيذ الرشيق|Launch readiness and rollout::الاستعداد للإطلاق والتدرج فيه"],
      ["Product measurement, growth and governance::قياس المنتج ونموه وحوكمته", "Activation, retention and churn::التفعيل والاحتفاظ والتسرب|Cohorts, funnels and experiments::المجموعات والمسارات والتجارب|Pricing, growth and lifecycle::التسعير والنمو ودورة الحياة|Privacy, AI risk and product ethics::الخصوصية ومخاطر الذكاء الاصطناعي وأخلاقيات المنتج"]
    ],
    data: [
      ["Data sourcing, SQL and preparation::مصادر البيانات والاستعلام وإعدادها", "Tables, keys and joins::الجداول والمفاتيح والربط|Filtering, grouping and aggregation::التصفية والتجميع والتلخيص|Missingness, duplicates and outliers::البيانات المفقودة والتكرار والقيم الشاذة|Transformation and validation::التحويل والتحقق"],
      ["Statistical analysis and experiments::التحليل الإحصائي والتجارب", "Distributions and descriptive measures::التوزيعات والمقاييس الوصفية|Sampling and confidence intervals::العينات وفترات الثقة|Hypothesis tests and error types::اختبارات الفرضيات وأنواع الأخطاء|Regression, experiments and causality::الانحدار والتجارب والسببية"],
      ["Visualization, dashboards and communication::التصور ولوحات المتابعة والتواصل", "Chart selection and visual encoding::اختيار الرسوم والترميز البصري|Dashboard hierarchy and usability::التسلسل وسهولة الاستخدام في اللوحات|Narrative and executive reporting::السرد والتقارير التنفيذية|Accessibility and misleading displays::إمكانية الوصول والعروض المضللة"],
      ["Analytics models, governance and reproducibility::النماذج التحليلية والحوكمة وقابلية إعادة الإنتاج", "Forecasting and time-series methods::التنبؤ وأساليب السلاسل الزمنية|Supervised and unsupervised models::النماذج الموجهة وغير الموجهة|Data lineage, quality and privacy::مصدر البيانات وجودتها وخصوصيتها|Reproducible analysis and portfolio::التحليل القابل لإعادة الإنتاج وملف الأعمال"]
    ],
    bi: [
      ["Business measures and decision models::مقاييس الأعمال ونماذج القرار", "Metric definitions and ownership::تعريف المقاييس وملكيتها|Key performance indicator design::تصميم مؤشرات الأداء الرئيسية|Tactical, operational and strategic use::الاستخدام التكتيكي والتشغيلي والاستراتيجي|Relevance, timeliness and accuracy::الملاءمة والحداثة والدقة"],
      ["BI data architecture and semantic models::هندسة بيانات ذكاء الأعمال ونماذجها الدلالية", "Data warehouses, lakes and marts::مستودعات البيانات والبحيرات والمخازن|Facts, dimensions and grain::الوقائع والأبعاد ومستوى التفصيل|Calculated fields and semantic layers::الحقول المحسوبة والطبقات الدلالية|ETL, refresh and pipeline monitoring::النقل والتحديث ومراقبة خطوط البيانات"],
      ["Dashboard design and insight communication::تصميم لوحات المتابعة والتواصل بالرؤى", "Chart categories and visual encoding::أنواع الرسوم والترميز البصري|Color, accessibility and responsiveness::الألوان والإتاحة والتجاوب|Storytelling and executive summaries::السرد والملخصات التنفيذية|Interpretability and action design::قابلية التفسير وتصميم الإجراء"],
      ["BI governance, cloud and domain applications::حوكمة ذكاء الأعمال والسحابة والتطبيقات القطاعية", "Lineage, quality and compliance::المصدر والجودة والامتثال|Privacy, bias and responsible analytics::الخصوصية والتحيز والتحليلات المسؤولة|Cloud BI platforms and cost::منصات ذكاء الأعمال السحابية وتكلفتها|Finance, healthcare and supply applications::تطبيقات التمويل والصحة والإمداد"]
    ],
    python: [
      ["Python syntax, environments and package practice::قواعد بايثون والبيئات والحزم", "Types, operators and control flow::الأنواع والمعاملات وتدفق التحكم|Functions, arguments and lambdas::الدوال والمعاملات والدوال المجهولة|Virtual environments and package managers::البيئات الافتراضية ومديرو الحزم|Notebooks, scripts and debugging::دفاتر العمل والبرامج النصية وتصحيح الأخطاء"],
      ["Numerical and tabular data libraries::مكتبات البيانات العددية والجدولية", "Array creation and indexing::إنشاء المصفوفات وفهرستها|Vectorized operations and linear algebra::العمليات المتجهية والجبر الخطي|DataFrames, filtering and grouping::إطارات البيانات والتصفية والتجميع|Joining, reshaping and aggregation::الربط وإعادة التشكيل والتلخيص"],
      ["Cleaning, exploratory analysis and statistical methods::التنظيف والتحليل الاستكشافي والأساليب الإحصائية", "Parsing dates and text::تحليل التواريخ والنصوص|Missing data and imputation::البيانات المفقودة والتعويض|Outlier checks and distributions::فحوص القيم الشاذة والتوزيعات|Correlation, regression and uncertainty::الارتباط والانحدار وعدم اليقين"],
      ["Visualization, external data and reproducible projects::التصور والبيانات الخارجية والمشروعات القابلة لإعادة الإنتاج", "Matplotlib and Seaborn plots::رسوم ماتبلوتليب وسيبورن|Interactive plots and dashboards::الرسوم التفاعلية ولوحات المتابعة|APIs and web data collection::واجهات التطبيقات وجمع بيانات الويب|Project structure, validation and communication::بنية المشروع والتحقق والتواصل"]
    ],
    systems: [
      ["Architecture, interfaces and integration::الهندسة والواجهات والتكامل", "Architecture principles and views::مبادئ الهندسة ووجهاتها|Application boundaries and APIs::حدود التطبيقات وواجهاتها|Events, messaging and workflows::الأحداث والرسائل وسير العمل|Legacy integration and migration::تكامل الأنظمة القديمة وترحيلها"],
      ["Infrastructure, cloud and software delivery::البنية التحتية والسحابة وتسليم البرمجيات", "Operating systems and network services::أنظمة التشغيل وخدمات الشبكات|Containers and orchestration::الحاويات والتنسيق|Cloud service and deployment models::نماذج الخدمات السحابية والنشر|Automation and configuration management::الأتمتة وإدارة الإعدادات"],
      ["Security, data protection and risk::الأمن وحماية البيانات والمخاطر", "Identity, roles and access::الهوية والأدوار والوصول|Encryption and key management::التشفير وإدارة المفاتيح|Vulnerability and incident response::الثغرات والاستجابة للحوادث|Privacy, compliance and controls::الخصوصية والامتثال والضوابط"],
      ["Reliability, operations and service governance::الاعتمادية والتشغيل وحوكمة الخدمات", "Monitoring and service objectives::المراقبة وأهداف الخدمة|Incident, problem and change practice::ممارسة إدارة الحوادث والمشكلات والتغيير|Backup, recovery and continuity::النسخ والتعافي والاستمرارية|Capacity, cost and performance::الطاقة والتكلفة والأداء"]
    ],
    database: [
      ["SQL, relational design and transaction behavior::الاستعلام والتصميم العلائقي وسلوك المعاملات", "Data definition and manipulation::تعريف البيانات ومعالجتها|Keys, constraints and normalization::المفاتيح والقيود والتطبيع|Joins, subqueries and window functions::الربط والاستعلامات الفرعية والدوال النافذية|Transactions, locks and isolation::المعاملات والأقفال والعزل"],
      ["Query plans, indexing and performance::خطط الاستعلام والفهرسة والأداء", "Explain plans and row estimates::خطط التنفيذ وتقديرات الصفوف|B-tree, hash and specialized indexes::فهارس الأشجار والتجزئة والأنواع المتخصصة|Statistics and planner behavior::الإحصاءات وسلوك المخطط|Workload analysis and tuning::تحليل أحمال العمل وتحسينها"],
      ["Database security, backup and recovery::أمن قواعد البيانات والنسخ والتعافي", "Authentication and role privileges::التحقق من الهوية وصلاحيات الأدوار|Encrypted connections and access rules::الاتصالات المشفرة وقواعد الوصول|Logical and physical backups::النسخ المنطقي والمادي|Point-in-time recovery and validation::التعافي الزمني والتحقق"],
      ["Replication, automation and production reliability::التكرار والأتمتة واعتمادية الإنتاج", "Streaming and logical replication::التكرار بالتدفق والمنطق|Failover, pooling and load balancing::التحويل عند العطل وتجميع الاتصالات وموازنة الأحمال|Monitoring, logs and incidents::المراقبة والسجلات والحوادث|Automation, migration and runbooks::الأتمتة والترحيل وأدلة التشغيل"]
    ],
    business: [
      ["Markets, customers and competitive choices::الأسواق والعملاء والخيارات التنافسية", "Market structure and trends::هيكل السوق واتجاهاته|Customer segments and needs::شرائح العملاء واحتياجاتهم|Competitor and substitute analysis::تحليل المنافسين والبدائل|Positioning and advantage::التموضع والميزة"],
      ["Financial, economic and strategic decisions::القرارات المالية والاقتصادية والاستراتيجية", "Revenue, cost and contribution::الإيراد والتكلفة وهامش المساهمة|Budgets, cash and forecasts::الموازنات والنقدية والتوقعات|Investment and business cases::الاستثمارات ومبررات الأعمال|Scenarios, risk and trade-offs::السيناريوهات والمخاطر والمفاضلات"],
      ["People, operating models and performance::الأفراد ونماذج التشغيل والأداء", "Roles, teams and accountability::الأدوار والفرق والمساءلة|Processes, capacity and quality::العمليات والطاقة والجودة|Measures and performance reviews::المقاييس ومراجعات الأداء|Change and execution::التغيير والتنفيذ"],
      ["Governance, ethics and sustainable value::الحوكمة والأخلاقيات والقيمة المستدامة", "Boards, controls and accountability::المجالس والضوابط والمساءلة|Contracts and regulatory duties::العقود والالتزامات التنظيمية|Privacy and responsible data::الخصوصية والبيانات المسؤولة|Sustainability and social outcomes::الاستدامة والنتائج الاجتماعية"]
    ],
    operations: [
      ["Process flow, capacity and planning::تدفق العمليات والطاقة والتخطيط", "Process maps and handoffs::خرائط العمليات ونقاط التسليم|Capacity and bottleneck analysis::تحليل الطاقة والاختناقات|Forecasts and schedules::التوقعات والجداول|Workforce and service design::تصميم القوى العاملة والخدمات"],
      ["Inventory, procurement and supplier performance::المخزون والمشتريات وأداء الموردين", "Inventory costs and policies::تكاليف المخزون وسياساته|Safety stock and reorder points::مخزون الأمان ونقاط إعادة الطلب|Sourcing and contract decisions::قرارات التوريد والعقود|Supplier quality and delivery::جودة الموردين والتسليم"],
      ["Quality, production and continuous improvement::الجودة والإنتاج والتحسين المستمر", "Variation and process capability::التباين وقدرة العملية|Root-cause and corrective action::تحليل الأسباب والإجراءات التصحيحية|Production planning and sequencing::تخطيط الإنتاج وترتيبه|Lean waste and improvement cycles::الهدر ودورات التحسين الرشيق"],
      ["Logistics, resilience and operational outcomes::اللوجستيات والمرونة والنتائج التشغيلية", "Transport and warehouse operations::عمليات النقل والمستودعات|Network and fulfillment design::تصميم الشبكات والتنفيذ|Risk, continuity and recovery::المخاطر والاستمرارية والتعافي|Sustainability and service measures::الاستدامة ومقاييس الخدمة"]
    ],
    applied: [
      ["Sector users, stakeholders and value::مستخدمو القطاع وأصحاب المصلحة والقيمة", "Users and community needs::احتياجات المستخدمين والمجتمع|Providers, partners and regulators::مقدمو الخدمة والشركاء والمنظمون|Service journeys and access::رحلات الخدمة والوصول|Value, outcomes and affordability::القيمة والنتائج والقدرة على التحمل"],
      ["Service delivery, people and resources::تقديم الخدمة والأفراد والموارد", "Workforce and capability::القوى العاملة والقدرات|Facilities and asset management::إدارة المنشآت والأصول|Capacity and service standards::الطاقة ومعايير الخدمة|Budget and operational planning::الموازنة والتخطيط التشغيلي"],
      ["Quality, technology and applied analytics::الجودة والتقنية والتحليلات التطبيقية", "Quality, safety and incident learning::الجودة والسلامة والتعلم من الحوادث|Digital records and information systems::السجلات الرقمية ونظم المعلومات|Operational and outcome measures::مقاييس التشغيل والنتائج|Evidence and improvement cycles::الأدلة ودورات التحسين"],
      ["Regulation, ethics and sustainable impact::التنظيم والأخلاقيات والأثر المستدام", "Compliance and professional boundaries::الامتثال والحدود المهنية|Privacy and sensitive information::الخصوصية والمعلومات الحساسة|Equity and accessibility::الإنصاف وإمكانية الوصول|Environmental and social impact::الأثر البيئي والاجتماعي"]
    ],
    professional: [
      ["Evidence, research and critical judgment::الأدلة والبحث والحكم النقدي", "Search and source credibility::البحث وموثوقية المصادر|Reasoning and argument::الاستدلال والحجة|Bias and uncertainty::التحيز وعدم اليقين|Ethical and accurate claims::الادعاءات الأخلاقية والدقيقة"],
      ["Communication, collaboration and feedback::التواصل والتعاون والتغذية الراجعة", "Clear writing and summaries::الكتابة الواضحة والملخصات|Listening and questioning::الاستماع وطرح الأسئلة|Team collaboration and feedback::التعاون والتغذية الراجعة في الفريق|Presentation and storytelling::العرض والسرد"],
      ["Self-management and professional growth::إدارة الذات والنمو المهني", "Goals and time priorities::الأهداف وأولويات الوقت|Reflection and continuous learning::التأمل والتعلم المستمر|Career planning and portfolio::التخطيط المهني وملف الأعمال|Wellbeing and sustainable habits::الرفاه والعادات المستدامة"],
      ["Ethics, inclusion and responsible digital practice::الأخلاقيات والشمول والممارسة الرقمية المسؤولة", "Confidentiality and privacy::السرية والخصوصية|Fairness and inclusion::الإنصاف والشمول|AI and automation oversight::الإشراف على الذكاء الاصطناعي والأتمتة|Accountability and documentation::المساءلة والتوثيق"]
    ]
  };
  const pathSpecs = [];
  const addList = (category, track, value) => value.trim().split("\n").filter(Boolean).forEach((row) => {
    const [en, ar] = row.split("::");
    pathSpecs.push({ category, track, en: en.trim(), ar: ar.trim() });
  });

  addList("communication", "communication", `
Business communication::التواصل في الأعمال
Workplace communication::التواصل في بيئة العمل
Executive communication::التواصل مع القيادات
Technical communication::التواصل التقني
Interpersonal communication::التواصل بين الأفراد
Nonverbal communication and body language::التواصل غير اللفظي ولغة الجسد
Public speaking::التحدث أمام الجمهور
Professional presentations::العروض المهنية
Presentation design::تصميم العروض
Data storytelling::سرد القصص بالبيانات
Business storytelling::السرد القصصي للأعمال
Visual communication::التواصل البصري
Active listening::الاستماع الفعال
Questioning and interviewing::طرح الأسئلة وإجراء المقابلات
Difficult conversations::الحوارات الصعبة
Feedback skills::مهارات تقديم الملاحظات وتلقيها
Conflict resolution communication::التواصل لحل النزاعات
Negotiation::التفاوض
Persuasive communication::التواصل الإقناعي
Influence without authority::التأثير دون سلطة مباشرة
Stakeholder communication::التواصل مع أصحاب المصلحة
Crisis communication::التواصل أثناء الأزمات
Customer communication::التواصل مع العملاء
Customer support communication::التواصل في دعم العملاء
Sales communication::التواصل في المبيعات
Internal communication::التواصل الداخلي
Organizational communication::التواصل المؤسسي
Change communication::التواصل بشأن التغيير
Investor communication::التواصل مع المستثمرين
Public relations::العلاقات العامة
Media relations::العلاقات مع وسائل الإعلام
Communication strategy::استراتيجية التواصل
Communication planning::تخطيط التواصل
Written communication::التواصل الكتابي
Business writing::الكتابة المهنية للأعمال
Technical writing::الكتابة التقنية
Executive writing::الكتابة الموجهة للقيادات
Report writing::كتابة التقارير
Professional email writing::كتابة البريد المهني
Cross-cultural communication::التواصل بين الثقافات
Intercultural communication::التواصل في البيئات متعددة الثقافات
Remote communication::التواصل عن بعد
Hybrid team communication::التواصل في الفرق الهجينة
Facilitation skills::مهارات التيسير
Meeting facilitation::تيسير الاجتماعات
Visual facilitation::التيسير البصري
Nonviolent communication::التواصل اللاعنفي
Assertive communication::التواصل الحازم
Communication accessibility::إتاحة التواصل
Communication coaching::التدريب على التواصل
High-stakes communication::التواصل في المواقف الحساسة
Communication research and evaluation::بحث التواصل وتقييمه
`);

  addList("psychology", "psychology", `
Psychology foundations::أسس علم النفس
Cognitive psychology::علم النفس المعرفي
Social psychology::علم النفس الاجتماعي
Industrial-organizational psychology::علم النفس الصناعي والتنظيمي
Behavioral psychology::علم النفس السلوكي
Personality psychology::علم نفس الشخصية
Developmental psychology::علم النفس النمائي
Educational psychology::علم النفس التربوي
Health psychology::علم النفس الصحي
Neuropsychology foundations::أسس علم النفس العصبي
Sport psychology::علم النفس الرياضي
Group psychology::علم نفس الجماعات
Cultural psychology::علم النفس الثقافي
Environmental psychology::علم النفس البيئي
Consumer psychology::علم نفس المستهلك
Psychology of motivation::علم نفس الدافعية
Emotion science::علم الانفعالات
Psychology of learning::علم نفس التعلم
Psychology of memory::علم نفس الذاكرة
Attention and cognition::الانتباه والإدراك
Judgment and decision psychology::علم نفس الحكم واتخاذ القرار
Cognitive biases and judgment::التحيزات المعرفية والأحكام
Social cognition::الإدراك الاجتماعي
Interpersonal perception::الإدراك بين الأفراد
Psychology of influence and persuasion::علم نفس التأثير والإقناع
Psychology of work::علم نفس العمل
Coaching psychology foundations::أسس علم نفس التوجيه
Human factors psychology::علم نفس العوامل البشرية
Psychological safety at work::الأمان النفسي في العمل
Stress and coping psychology::علم نفس الضغط والتكيف
Wellbeing psychology::علم نفس الرفاه
Resilience psychology::علم نفس المرونة
Conflict psychology::علم نفس النزاع
Negotiation psychology::علم نفس التفاوض
Psychological measurement::القياس النفسي
Psychological research methods::مناهج البحث النفسي
Psychology of communication::علم نفس التواصل
Habit formation and behavior::تكوين العادات والسلوك
Behavior change science::علم تغيير السلوك
Psychology of teams::علم نفس الفرق
Employee experience psychology::علم نفس تجربة العاملين
Occupational health psychology::علم النفس والصحة المهنية
Psychology of leadership::علم نفس القيادة
Inclusive organizational psychology::علم النفس التنظيمي الشامل
Psychology of trust::علم نفس الثقة
Psychology of feedback::علم نفس التغذية الراجعة
Psychology of creativity::علم نفس الإبداع
Psychology of learning at work::علم نفس التعلم في العمل
`);

  addList("people", "people", `
Soft skills foundations::أسس المهارات الشخصية والمهنية
Emotional intelligence::الذكاء العاطفي
Self-awareness::الوعي بالذات
Self-regulation::تنظيم الذات
Empathy skills::مهارات التعاطف
Personal resilience::المرونة الشخصية
Stress management::إدارة الضغوط
Time management::إدارة الوقت
Focus and attention management::إدارة التركيز والانتباه
Personal productivity::الإنتاجية الشخصية
Critical thinking::التفكير النقدي
Creative thinking::التفكير الإبداعي
Problem-solving skills::مهارات حل المشكلات
Decision-making skills::مهارات اتخاذ القرار
Systems thinking::التفكير المنظومي
Strategic thinking::التفكير الاستراتيجي
Adaptability at work::المرونة في العمل
Continuous learning habits::عادات التعلم المستمر
Growth mindset::عقلية النمو
Accountability and ownership::المساءلة وتحمل المسؤولية
Professional judgment::الحكم المهني
Teamwork skills::مهارات العمل الجماعي
Collaboration skills::مهارات التعاون
Team dynamics::ديناميكيات الفريق
Trust building at work::بناء الثقة في العمل
Psychological safety practice::تطبيقات الأمان النفسي
Collaborative leadership::القيادة التعاونية
Inclusive leadership::القيادة الشاملة
Servant leadership::القيادة الخادمة
Situational leadership::القيادة الموقفية
Leading without authority::القيادة دون سلطة مباشرة
Coaching skills::مهارات التوجيه
Mentoring skills::مهارات الإرشاد المهني
Delegation skills::مهارات التفويض
Career development planning::تخطيط التطور المهني
Giving and receiving feedback::تقديم الملاحظات وتلقيها
Relationship building::بناء العلاقات
Influence and persuasion skills::مهارات التأثير والإقناع
Meeting management::إدارة الاجتماعات
One-to-one management conversations::حوارات المتابعة الفردية
Performance conversations::حوارات الأداء
Employee motivation::تحفيز العاملين
Recognition and appreciation::التقدير والاعتراف بالجهد
Work boundaries and balance::حدود العمل والتوازن
Professional networking::بناء العلاقات المهنية
Remote collaboration::التعاون عن بعد
Cross-functional collaboration::التعاون بين التخصصات
Organizational awareness::الوعي المؤسسي
Workplace culture building::بناء ثقافة العمل
Change readiness skills::مهارات الاستعداد للتغيير
`);

  addList("people", "engineering", `
Engineering Manager::مدير الهندسة
Technical leadership::القيادة التقنية
Engineering strategy::استراتيجية الهندسة
Architecture decision-making::اتخاذ القرارات المعمارية
Software architecture::هندسة البرمجيات
System design::تصميم الأنظمة
Technical debt management::إدارة الدين التقني
Developer experience::تجربة المطورين
Engineering productivity::إنتاجية فرق الهندسة
Engineering metrics::مقاييس فرق الهندسة
Code review practice::ممارسة مراجعة الشيفرة
Software quality management::إدارة جودة البرمجيات
Software testing strategy::استراتيجية اختبار البرمجيات
Continuous integration and delivery::التكامل والتسليم المستمران
Release engineering::هندسة الإصدارات
Site reliability engineering::هندسة اعتمادية المواقع
Incident management for engineering teams::إدارة الحوادث لفرق الهندسة
Infrastructure scaling::توسيع البنية التحتية
Production performance management::إدارة أداء الأنظمة في الإنتاج
Cloud cost management::إدارة تكاليف الحوسبة السحابية
Security engineering management::إدارة هندسة الأمن
Technical risk assessment::تقييم المخاطر التقنية
Disaster recovery planning::تخطيط التعافي من الكوارث
Legacy system migration::ترحيل الأنظمة القديمة
Technical documentation::التوثيق التقني
Engineering knowledge management::إدارة المعرفة الهندسية
Engineering recruitment::استقطاب الكفاءات الهندسية
Team topology and design::أنماط الفرق وتصميمها
Engineering performance management::إدارة أداء فرق الهندسة
Coaching engineers::توجيه المهندسين
Engineering career development::التطور المهني للمهندسين
Delegation for engineering leaders::التفويض لقادة الهندسة
Engineering capacity planning::تخطيط طاقة فرق الهندسة
Engineering culture::ثقافة فرق الهندسة
Engineering stakeholder management::إدارة أصحاب المصلحة الهندسيين
Vendor management for technology teams::إدارة الموردين للفرق التقنية
Technology partnerships::الشراكات التقنية
Architecture governance::حوكمة الهندسة المعمارية
Platform engineering::هندسة المنصات
DevOps engineering::هندسة التطوير والتشغيل
Production incident response::الاستجابة لحوادث الإنتاج
Blameless postmortems::مراجعة الحوادث دون لوم
Engineering budgeting::إعداد موازنات الهندسة
Engineering resource forecasting::توقع احتياجات الموارد الهندسية
Engineering change management::إدارة التغيير الهندسي
Cross-functional engineering leadership::القيادة الهندسية بين الفرق
`);

  addList("analysis", "product", `
Product discovery::استكشاف المنتجات
Product roadmapping::إعداد خرائط طريق المنتجات
Product analytics::تحليلات المنتجات
Product operations::عمليات إدارة المنتجات
Product-led growth::النمو القائم على المنتج
Product experimentation::التجارب في المنتجات
Product pricing::تسعير المنتجات
Product portfolio management::إدارة محفظة المنتجات
Platform product management::إدارة المنتجات المنصاتية
AI product management::إدارة منتجات الذكاء الاصطناعي
Data product management::إدارة منتجات البيانات
B2B product management::إدارة المنتجات بين الشركات
Product-market fit::التوافق بين المنتج والسوق
User experience research::بحوث تجربة المستخدم
User research methods::مناهج بحث المستخدمين
Usability testing::اختبار سهولة الاستخدام
User story mapping::رسم قصص المستخدمين
Product requirements and specifications::متطلبات المنتجات ومواصفاتها
Go-to-market strategy::استراتيجية دخول السوق
Product launch management::إدارة إطلاق المنتجات
Feature prioritization::ترتيب أولويات الخصائص
Product metrics and measurement::مقاييس المنتجات وقياسها
Product growth strategy::استراتيجية نمو المنتجات
Product risk management::إدارة مخاطر المنتجات
Product internationalization::تدويل المنتجات
Product localization::مواءمة المنتجات للأسواق المحلية
Product management for platforms::إدارة المنتجات المنصاتية
Product lifecycle management::إدارة دورة حياة المنتج
Customer problem framing::صياغة مشكلات العملاء
Product value proposition design::تصميم عرض قيمة المنتج
Product business cases::مبررات المنتجات التجارية
Product discovery interviews::مقابلات استكشاف المنتجات
Product strategy and positioning::استراتيجية المنتج وتموضعه
Product design collaboration::التعاون في تصميم المنتجات
Product release planning::تخطيط إصدارات المنتجات
Feature adoption and activation::تبني الخصائص وتفعيلها
Customer retention analytics::تحليلات الاحتفاظ بالعملاء
`);

  addList("data", "data", `
Data analyst::محلل البيانات
Python for data analysis::بايثون لتحليل البيانات
BI analyst::محلل ذكاء الأعمال
Excel for data analysis::إكسل لتحليل البيانات
R for data analysis::آر لتحليل البيانات
Statistics for data analysis::الإحصاء لتحليل البيانات
Data collection methods::أساليب جمع البيانات
Data acquisition::اكتساب البيانات
APIs for data analysis::واجهات تبادل البيانات للتحليل
Web scraping for analytics::استخراج بيانات الويب للتحليل
Data formats and interoperability::تنسيقات البيانات والتوافق بينها
CSV data workflows::معالجة ملفات البيانات الجدولية
JSON data workflows::معالجة البيانات بصيغة جيسون
Parquet data workflows::معالجة البيانات بصيغة باركيه
Missing data analysis::تحليل البيانات المفقودة
Outlier detection::اكتشاف القيم الشاذة
Data transformation::تحويل البيانات
Exploratory data analysis::تحليل البيانات الاستكشافي
Descriptive statistics::الإحصاء الوصفي
Inferential statistics::الإحصاء الاستدلالي
Hypothesis testing::اختبار الفرضيات
Correlation and causation analysis::تحليل الارتباط والسببية
Regression analysis::تحليل الانحدار
Time-series analysis::تحليل السلاسل الزمنية
Business forecasting::التنبؤ للأعمال
A/B testing and experimentation::اختبار البدائل والتجارب
Customer cohort analysis::تحليل مجموعات العملاء
Customer segmentation analytics::تحليلات تقسيم العملاء
Funnel analysis::تحليل مسارات التحويل
Predictive analytics::التحليلات التنبؤية
Prescriptive analytics::التحليلات التوجيهية
Data visualization design::تصميم تصورات البيانات
Dashboard design::تصميم لوحات المتابعة
Analytics reporting::إعداد التقارير التحليلية
Tactical business intelligence::ذكاء الأعمال التشغيلي اليومي
Strategic business intelligence::ذكاء الأعمال الاستراتيجي
Operational business intelligence::ذكاء الأعمال التشغيلي
Business performance metrics::مقاييس أداء الأعمال
Metric and KPI design::تصميم المقاييس ومؤشرات الأداء
Data modeling for analytics::نمذجة البيانات للتحليل
Dimensional modeling::النمذجة البعدية للبيانات
Star and snowflake schemas::مخططات النجمة والثلجية
Semantic layer design::تصميم الطبقة الدلالية للبيانات
Power BI analytics::تحليلات باور بي آي
Tableau analytics::تحليلات تابلو
Qlik analytics::تحليلات كليك
Looker analytics::تحليلات لوكر
NumPy for data analysis::نومباي لتحليل البيانات
Pandas for data analysis::باندا لتحليل البيانات
Polars for data analysis::بولارز لتحليل البيانات
SciPy for data analysis::ساي باي لتحليل البيانات
Matplotlib visualization::التصور باستخدام ماتبلوتليب
Seaborn visualization::التصور باستخدام سيبورن
Plotly interactive visualization::التصور التفاعلي باستخدام بلوتلي
Jupyter data notebooks::دفاتر العمل لتحليل البيانات
Python data cleaning::تنظيف البيانات ببايثون
Pandas data cleaning::تنظيف البيانات باستخدام باندا
R data wrangling::تهيئة البيانات بلغة آر
Dplyr data manipulation::معالجة البيانات باستخدام دبلير
Ggplot2 visualization::التصور باستخدام جغبلوت٢
Spreadsheet formulas and analysis::صيغ الجداول الإلكترونية وتحليلها
Pivot tables and summaries::الجداول المحورية والملخصات
ETL for analytics::استخراج البيانات وتحويلها وتحميلها للتحليل
ELT analytics pipelines::خطوط تحويل البيانات داخل منصات التحليل
Data pipeline design::تصميم خطوط تدفق البيانات
Analytics workflow orchestration::تنسيق سير التحليل
Apache Airflow for data workflows::تنسيق تدفقات البيانات باستخدام أباتشي إيرفلو
dbt analytics engineering::هندسة التحليلات باستخدام دي بي تي
Cloud business intelligence::ذكاء الأعمال السحابي
Cloud data warehousing::مستودعات البيانات السحابية
Data lakes and lakehouses::بحيرات البيانات ومنصاتها الموحدة
Big data analytics::تحليلات البيانات الضخمة
Apache Spark analytics::تحليلات البيانات باستخدام أباتشي سبارك
Hadoop data processing::معالجة البيانات باستخدام هادوب
Dask parallel analytics::التحليلات المتوازية باستخدام داسك
Data risk analytics::تحليلات مخاطر البيانات
Financial performance analytics::تحليلات الأداء المالي
Healthcare analytics::تحليلات الرعاية الصحية
Marketing campaign analytics::تحليلات الحملات التسويقية
Sales performance analytics::تحليلات أداء المبيعات
Supply chain analytics::تحليلات سلاسل الإمداد
Manufacturing analytics::تحليلات التصنيع
`);

  addList("systems", "database", `
SQL for data analysis::لغة الاستعلام لتحليل البيانات
Advanced SQL querying::الاستعلامات المتقدمة لقواعد البيانات
PostgreSQL performance tuning::تحسين أداء بوستجريس
Database query optimization::تحسين استعلامات قواعد البيانات
Database security engineering::هندسة أمن قواعد البيانات
Database backup and recovery::النسخ الاحتياطي لقواعد البيانات والتعافي
Database high availability::التوافر العالي لقواعد البيانات
Database replication engineering::هندسة تكرار قواعد البيانات
Database migration engineering::هندسة ترحيل قواعد البيانات
Database observability::رصد قواعد البيانات
Database automation::أتمتة إدارة قواعد البيانات
Database reliability engineering::هندسة اعتمادية قواعد البيانات
Connection pooling::تجميع اتصالات قواعد البيانات
Database partitioning::تقسيم البيانات في قواعد البيانات
Data sharding patterns::أنماط تجزئة البيانات
Data anonymization engineering::هندسة إخفاء هوية البيانات
PostgreSQL logical replication::التكرار المنطقي في بوستجريس
Database extension development::تطوير إضافات قواعد البيانات
Managed cloud databases::قواعد البيانات السحابية المدارة
NoSQL database foundations::أسس قواعد البيانات غير العلائقية
MongoDB administration::إدارة مونجو دي بي
MySQL administration::إدارة ماي إس كيو إل
Redis data stores::مخازن البيانات باستخدام ريديس
Database internals::البنية الداخلية لقواعد البيانات
Kubernetes stateful systems::الأنظمة ذات الحالة على كوبرنيتس
Infrastructure automation::أتمتة البنية التحتية
Ansible infrastructure management::إدارة البنية التحتية باستخدام أنسبل
Git and collaborative version control::جيت وإدارة الإصدارات بالتعاون
Container operations::تشغيل الحاويات البرمجية
CI/CD pipeline engineering::هندسة خطوط التكامل والتسليم المستمرين
`);

  addList("accounting", "business", `
Payroll accounting::محاسبة الأجور والرواتب
Revenue accounting::محاسبة الإيرادات
Fixed asset accounting::محاسبة الأصول الثابتة
Financial close management::إدارة الإقفال المالي
Sustainability accounting::محاسبة الاستدامة
Accounting policy development::تطوير السياسات المحاسبية
Financial reporting controls::ضوابط التقارير المالية
XBRL financial reporting::إعداد التقارير المالية بصيغة إكس بي آر إل
Corporate treasury management::إدارة خزينة الشركات
Financial planning and analysis::التخطيط والتحليل المالي
Cash management::إدارة النقدية
Portfolio management::إدارة المحافظ الاستثمارية
Investment banking foundations::أسس الخدمات المصرفية الاستثمارية
Venture capital::رأس المال الجريء
Private equity::الاستثمار في الملكية الخاصة
Credit risk analysis::تحليل مخاطر الائتمان
Bank risk management::إدارة المخاطر المصرفية
International finance::التمويل الدولي
Startup finance::تمويل الشركات الناشئة
Responsible investment analysis::تحليل الاستثمار المسؤول
Customer success management::إدارة نجاح العملاء
Customer support operations::عمليات دعم العملاء
Sales enablement::تمكين فرق المبيعات
Business model design::تصميم نماذج الأعمال
Organizational design::التصميم التنظيمي
Family business management::إدارة الشركات العائلية
Franchise operations::عمليات الامتياز التجاري
Market entry strategy::استراتيجية دخول الأسواق
Service design::تصميم الخدمات
Small business growth::نمو المشروعات الصغيرة
`);

  addList("operations", "operations", `
Logistics management::إدارة الخدمات اللوجستية
Warehouse management::إدارة المستودعات
Demand planning::تخطيط الطلب
Sales and operations planning::تخطيط المبيعات والعمليات
Freight and transportation management::إدارة الشحن والنقل
Distribution network planning::تخطيط شبكات التوزيع
Returns and reverse logistics::إدارة المرتجعات واللوجستيات العكسية
Production scheduling::جدولة الإنتاج
Maintenance and reliability management::إدارة الصيانة والاعتمادية
Lean operations::العمليات الرشيقة
Six Sigma quality improvement::تحسين الجودة بمنهجية ستة سيجما
Supplier relationship management::إدارة علاقات الموردين
`);

  addList("applied", "applied", `
Health informatics::المعلوماتية الصحية
Hospital operations management::إدارة عمليات المستشفيات
Healthcare quality improvement::تحسين جودة الرعاية الصحية
Patient experience management::إدارة تجربة المرضى
Public health analytics::تحليلات الصحة العامة
Education management::إدارة المؤسسات التعليمية
Retail analytics::تحليلات تجارة التجزئة
Real estate finance::التمويل العقاري
Real estate asset management::إدارة الأصول العقارية
Nonprofit fundraising::جمع التبرعات للمؤسسات غير الربحية
Public administration::الإدارة العامة
Sustainability reporting::إعداد تقارير الاستدامة
Insurance operations::عمليات التأمين
Manufacturing quality management::إدارة جودة التصنيع
Retail supply chain management::إدارة سلاسل إمداد التجزئة
`);

  const slug = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existingIds = new Set(DATA.roadmaps.map((roadmap) => roadmap.id));
  const newRoadmaps = [];
  for (const spec of pathSpecs) {
    const id = slug(spec.en);
    if (!id || existingIds.has(id)) continue;
    const focus = focusTracks[spec.track] || focusTracks.professional;
    const detailedSections = focus.concat(supplementalTracks[spec.track] || supplementalTracks.professional);
    const modules = detailedSections.map(([moduleTitle, topicPairs], index) => {
      const label = parseTitle(moduleTitle);
      return {
        title: index === 0
          ? { en: "Foundations: " + spec.en, ar: "أسس " + spec.ar }
          : index === 1
            ? { en: "Methods and practice: " + spec.en, ar: "الأساليب والتطبيق في " + spec.ar }
            : { en: label.en + ": " + spec.en, ar: label.ar + " في " + spec.ar },
        topics: topicPairs.split("|").map((pair) => ({ title: parseTitle(pair) }))
      };
    });
    newRoadmaps.push({
      id,
      category: spec.category,
      title: { en: spec.en, ar: spec.ar },
      summary: {
        en: "Study the concepts, evidence and practical methods of " + spec.en + ", then apply them to a focused case.",
        ar: "تعلّم مفاهيم «" + spec.ar + "» وأدلته وأساليبه العملية، ثم طبّقها على حالة محددة."
      },
      modules
    });
    existingIds.add(id);
  }
  DATA.roadmaps.push(...newRoadmaps);

  const pathById = new Map(DATA.roadmaps.map((roadmap) => [roadmap.id, roadmap]));
  const addModules = (id, modules) => {
    const roadmap = pathById.get(id);
    if (roadmap) roadmap.modules.push(...modules.map(parseModule));
  };
  const specificModules = {
    "engineering-manager": [
      ["Technical direction and architecture::التوجه التقني والهندسة المعمارية", "System design and scaling::تصميم الأنظمة وتوسيعها|Build-versus-buy decisions::قرارات البناء أو الشراء|Technical standards and strategy::المعايير والاستراتيجية التقنية|Technical debt prioritization::ترتيب أولويات الدين التقني|Code review and quality practices::مراجعة الشيفرة وممارسات الجودة|Testing and release workflows::مسارات الاختبار والإصدار|Security and technical risk::الأمن والمخاطر التقنية|Monitoring and performance::المراقبة والأداء"],
      ["Hiring, team development and leadership::التوظيف وتطوير الفريق والقيادة", "Engineering team structure::هيكل فريق الهندسة|Recruitment and selection::الاستقطاب والاختيار|One-to-one meetings::الاجتماعات الفردية|Performance evaluation::تقييم الأداء|Mentoring and coaching::الإرشاد والتوجيه|Career development plans::خطط التطور المهني|Delegation and ownership::التفويض وتحمل المسؤولية|Trust, motivation and team culture::الثقة والدافعية وثقافة الفريق"],
      ["Delivery, incidents and organizational alignment::التنفيذ والحوادث والمواءمة المؤسسية", "Sprint and release planning::تخطيط الدورات والإصدارات|Dependencies, scope and estimates::الاعتماديات والنطاق والتقديرات|Technical and business risk::المخاطر التقنية والتجارية|Incident response and recovery::الاستجابة للحوادث والتعافي|Blameless postmortems::مراجعة الحوادث دون لوم|Stakeholder and executive updates::تحديثات أصحاب المصلحة والقيادات|Budget and resource planning::تخطيط الميزانية والموارد|Change, knowledge and documentation::التغيير والمعرفة والتوثيق"]
    ],
    "product-management": [
      ["Product discovery and market evidence::استكشاف المنتج وأدلة السوق", "Problem framing and opportunity::صياغة المشكلة والفرصة|Market sizing and trends::تقدير حجم السوق واتجاهاته|User interviews and surveys::مقابلات المستخدمين واستبياناتهم|Personas and user journeys::شخصيات المستخدمين ورحلاتهم|Ethnographic and contextual research::البحث الإثنوغرافي والسياقي|Competitor and alternative analysis::تحليل المنافسين والبدائل|Value proposition canvas::لوحة عرض القيمة|Product-market fit evidence::أدلة التوافق بين المنتج والسوق"],
      ["Product strategy, roadmaps and requirements::استراتيجية المنتج وخرائط الطريق والمتطلبات", "Vision, mission and product narrative::الرؤية والرسالة وسرد المنتج|Goals, baselines and target measures::الأهداف وخطوط الأساس والمقاييس المستهدفة|Product capabilities and constraints::قدرات المنتج وقيوده|Outcome-based roadmaps::خرائط الطريق المرتبطة بالنتائج|Feature prioritization methods::أساليب ترتيب أولويات الخصائص|Product requirements documents::وثائق متطلبات المنتج|User stories and job stories::قصص المستخدم ومهام العمل|Backlog refinement and story mapping::تنقيح قائمة العمل ورسم القصص"],
      ["Design, launch, growth and product analytics::التصميم والإطلاق والنمو وتحليلات المنتج", "Design thinking and service design::التفكير التصميمي وتصميم الخدمات|Prototypes and usability testing::النماذج الأولية واختبارات سهولة الاستخدام|Agile engineering collaboration::التعاون الرشيق مع فرق الهندسة|Minimum viable products and rollout::المنتجات الأولية والإطلاق التدريجي|Go-to-market and launch plan::خطة دخول السوق والإطلاق|Activation, retention and churn::التفعيل والاحتفاظ والتسرب|Cohort, funnel and experiment analysis::تحليل المجموعات والمسارات والتجارب|AI, platform and portfolio decisions::قرارات الذكاء الاصطناعي والمنصات والمحافظ"]
    ],
    "python-for-data-analysis": [
      ["Python environments, language and libraries::بيئات بايثون واللغة والمكتبات", "Environment setup and package managers::إعداد البيئة ومديرو الحزم|Functions, arguments and built-ins::الدوال والمعاملات والدوال المدمجة|Collections and data structures::المجموعات وهياكل البيانات|NumPy arrays and operations::مصفوفات نومباي وعملياتها|Pandas Series and DataFrames::السلاسل وإطارات البيانات في باندا|Polars dataframes::إطارات البيانات في بولارز|Jupyter and notebook practice::التطبيق باستخدام دفاتر جوبيتر|Reading and writing common formats::قراءة التنسيقات الشائعة وكتابتها"],
      ["Data collection, cleaning and exploratory analysis::جمع البيانات وتنظيفها وتحليلها الاستكشافي", "Local files and spreadsheet data::الملفات المحلية وبيانات الجداول الإلكترونية|SQL and database connections::الاستعلامات والاتصال بقواعد البيانات|APIs and web data::واجهات البيانات وبيانات الويب|Missing values and duplicates::القيم المفقودة والتكرار|Outliers and robust checks::القيم الشاذة والفحوص المتينة|Types, dates and text cleaning::تنظيف الأنواع والتواريخ والنصوص|Grouping, joining and reshaping::التجميع والربط وإعادة التشكيل|Descriptive statistics and distributions::الإحصاءات الوصفية والتوزيعات"],
      ["Visualization, advanced analysis and reproducible delivery::التصور والتحليل المتقدم والتسليم القابل لإعادة الإنتاج", "Matplotlib and Seaborn charts::رسوم ماتبلوتليب وسيبورن|Interactive visualizations::التصورات التفاعلية|Correlation and regression::الارتباط والانحدار|IQR and score-based outlier checks::فحوص القيم الشاذة بالمدى الربيعي والدرجات|Feature engineering and models::هندسة الخصائص والنماذج|Parallel and large-scale processing::المعالجة المتوازية والواسعة|Reusable analysis functions and tests::دوال التحليل القابلة لإعادة الاستخدام واختبارها|Notebook narrative and project handoff::سرد دفتر العمل وتسليم المشروع"]
    ],
    "data-analyst": [
      ["Analyst foundations and data preparation::أسس التحليل وإعداد البيانات", "Analytics questions and decision types::أسئلة التحليل وأنواع القرارات|Spreadsheet functions and references::دوال الجداول الإلكترونية ومراجعها|Pivot tables and summaries::الجداول المحورية والملخصات|SQL filtering and joins::تصفية الاستعلامات والربط|Data sources and APIs::مصادر البيانات وواجهاتها|Missing values and duplicates::القيم المفقودة والتكرار|Transformation and validation::التحويل والتحقق|Descriptive statistics and distribution::الإحصاء الوصفي والتوزيع"],
      ["Inference, modeling and analyst portfolio::الاستدلال والنمذجة وملف أعمال المحلل", "Hypothesis tests and uncertainty::اختبارات الفرضيات وعدم اليقين|Correlation and regression::الارتباط والانحدار|Time series and forecasting::السلاسل الزمنية والتنبؤ|Supervised and unsupervised learning::التعلم الموجّه وغير الموجّه|Model evaluation::تقييم النماذج|Visualization and explanation::التصور والشرح|Business analysis portfolio::ملف أعمال تحليل الأعمال|Presenting findings and limitations::عرض النتائج والحدود"]
    ],
    "bi-analyst": [
      ["BI strategy, data modeling and platforms::استراتيجية ذكاء الأعمال ونمذجة البيانات ومنصاتها", "Tactical, operational and strategic BI::ذكاء الأعمال التكتيكي والتشغيلي والاستراتيجي|Business functions and stakeholder needs::وظائف الأعمال واحتياجات أصحاب المصلحة|Fact and dimension tables::جداول الوقائع والأبعاد|Star and snowflake schemas::مخططات النجمة والثلجية|Normalization and analytical models::التطبيع والنماذج التحليلية|ETL tools and data pipelines::أدوات نقل البيانات وخطوطها|Cloud warehouses, lakes and marts::المستودعات والبحيرات ومخازن البيانات السحابية|Calculated fields and measures::الحقول والمقاييس المحسوبة"],
      ["Dashboards, governance and BI practice::لوحات المتابعة والحوكمة وممارسة ذكاء الأعمال", "Chart choice and visual encoding::اختيار الرسوم والترميز البصري|Accessible and responsive dashboards::لوحات متابعة ميسرة ومتجاوبة|Misleading chart detection::اكتشاف الرسوم المضللة|Executive summaries and presentation::الملخصات التنفيذية والعرض|Data lineage and quality::مصدر البيانات وجودتها|Privacy, bias and responsible use::الخصوصية والتحيز والاستخدام المسؤول|Finance, health and operations use cases::تطبيقات التمويل والصحة والعمليات|Portfolio, interview and career preparation::الملف المهني والاستعداد للمقابلات والتطور الوظيفي"]
    ]
  };
  specificModules["data-analysis"] = specificModules["data-analyst"];
  specificModules["business-intelligence"] = specificModules["bi-analyst"];
  for (const [id, sections] of Object.entries(specificModules)) addModules(id, sections);

  DATA.expansionStats = { addedPathways: newRoadmaps.length };
  DATA.featured = [...new Set([...(DATA.featured || []), "engineering-manager", "python-for-data-analysis", "data-analyst", "bi-analyst", "soft-skills-foundations", "nonverbal-communication-and-body-language"])];
})();
