<?php

namespace App\Http\Controllers\Api\V1\ServiceOrders;

use App\Domain\ServiceOrders\Enums\ServiceOrderStatus;
use App\Domain\ServiceOrders\Services\ServiceOrderWorkflow;
use App\Http\Controllers\Controller;
use App\Models\{ServiceCustomer,ServiceOrder,User};
use Illuminate\Http\{JsonResponse,Request};
use Illuminate\Support\Facades\{Mail,Storage,URL};
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class ServiceOrderController extends Controller
{
    public function __construct(private readonly ServiceOrderWorkflow $workflow) {}

    public function index(Request $request): JsonResponse
    {
        $this->allow($request->user(), 'service_orders.view');
        $orders = ServiceOrder::query()->with(['customer','assignments.user:id,name,email','commercialQuote:id,number,status'])
            ->when($request->filled('customer_id'), fn($q)=>$q->where('customer_id',$request->integer('customer_id')))
            ->when($request->filled('technician_id'), fn($q)=>$q->whereHas('assignments',fn($a)=>$a->where('user_id',$request->integer('technician_id'))))
            ->when($request->filled('status'), fn($q)=>$q->where('status',$request->string('status')))
            ->when($request->filled('maintenance_type'), fn($q)=>$q->where('maintenance_type',$request->string('maintenance_type')))
            ->when($request->filled('number'), fn($q)=>$q->where('number','like','%'.$request->string('number').'%'))
            ->when($request->filled('from'), fn($q)=>$q->whereDate('created_at','>=',$request->date('from')))
            ->when($request->filled('to'), fn($q)=>$q->whereDate('created_at','<=',$request->date('to')))
            ->latest()->paginate(min(max($request->integer('per_page',25),1),100));
        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $this->allow($request->user(), 'service_orders.create');
        $data=$request->validate(['customer_id'=>['required','integer',Rule::exists('service_customers','id')],'commercial_quote_id'=>['nullable','integer',Rule::exists('commercial_quotes','id')],'maintenance_type'=>['required','string','max:100'],'description'=>['required','string','max:10000'],'service_location'=>['required','string','max:500'],'contact_name'=>['required','string','max:190'],'contact_phone'=>['nullable','string','max:40']]);
        $order=$this->workflow->create($data,$request->user()); return response()->json(['data'=>$this->detail($order)],201);
    }
    public function show(Request $request, ServiceOrder $serviceOrder): JsonResponse { $this->access($request->user(),$serviceOrder); return response()->json(['data'=>$this->detail($serviceOrder)]); }
    public function update(Request $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $this->allow($request->user(),'service_orders.manage'); abort_if($serviceOrder->closed(),422,'La orden cerrada es inmutable.');
        $data=$request->validate(['maintenance_type'=>['sometimes','string','max:100'],'description'=>['sometimes','string','max:10000'],'service_location'=>['sometimes','string','max:500'],'contact_name'=>['sometimes','string','max:190'],'contact_phone'=>['nullable','string','max:40'],'commercial_quote_id'=>['nullable','integer',Rule::exists('commercial_quotes','id')]]);
        $serviceOrder->update($data);$this->workflow->event($serviceOrder,$request->user(),'updated',array_keys($data));return response()->json(['data'=>$this->detail($serviceOrder->fresh())]);
    }
    public function assign(Request $request, ServiceOrder $serviceOrder): JsonResponse { $this->allow($request->user(),'service_orders.assign');$data=$request->validate(['user_ids'=>['required','array','min:1'],'user_ids.*'=>['integer','distinct']]); return response()->json(['data'=>$this->detail($this->workflow->assign($serviceOrder,$data['user_ids'],$request->user()))]); }
    public function start(Request $request, ServiceOrder $serviceOrder): JsonResponse { return response()->json(['data'=>$this->detail($this->workflow->start($serviceOrder,$request->user()))]); }
    public function activity(Request $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $this->assertTechnician($request->user(),$serviceOrder); abort_if($serviceOrder->closed(),422,'La orden cerrada es inmutable.');
        abort_unless($serviceOrder->status === ServiceOrderStatus::InProgress, 422, 'Solo puedes registrar actividades durante la ejecución.');
        $data=$request->validate(['description'=>['required','string','max:5000'],'arrived_at'=>['nullable','date'],'departed_at'=>['nullable','date','after_or_equal:arrived_at'],'observations'=>['nullable','string','max:5000'],'recommendations'=>['nullable','string','max:5000'],'equipments'=>['array'],'equipments.*.name'=>['required_with:equipments','string','max:190'],'equipments.*.quantity'=>['nullable','string','max:60'],'equipments.*.dimensions'=>['nullable','string','max:190'],'equipments.*.specifications'=>['nullable','string'],'materials'=>['array'],'materials.*.name'=>['required_with:materials','string','max:190'],'materials.*.quantity'=>['nullable','string','max:60'],'materials.*.unit'=>['nullable','string','max:50'],'materials.*.notes'=>['nullable','string']]);
        $activity=$serviceOrder->activities()->create([...collect($data)->except(['equipments','materials'])->all(),'user_id'=>$request->user()->id]); foreach($data['equipments']??[] as $e)$serviceOrder->equipments()->create($e);foreach($data['materials']??[] as $m)$serviceOrder->materials()->create($m);$this->workflow->event($serviceOrder,$request->user(),'activity_registered',['activity_id'=>$activity->id]);return response()->json(['data'=>$activity],201);
    }
    public function evidence(Request $request, ServiceOrder $serviceOrder): JsonResponse { $request->validate(['kind'=>['required',Rule::in(['before','during','after'])],'file'=>['required','file','mimetypes:image/jpeg,image/png,image/webp','max:10240']]);$this->workflow->storeEvidence($serviceOrder,$request->file('file'),$request->string('kind')->toString(),$request->user());return response()->json(['message'=>'Evidencia cargada correctamente.'],201); }
    public function complete(Request $request, ServiceOrder $serviceOrder): JsonResponse { return response()->json(['data'=>$this->detail($this->workflow->complete($serviceOrder,$request->user()))]); }
    public function signature(Request $request, ServiceOrder $serviceOrder): JsonResponse { $data=$request->validate(['role'=>['required',Rule::in(['technician','customer'])],'signer_name'=>['required','string','max:190'],'accepted'=>['accepted'],'signature'=>['required','string','max:1500000']]);$this->workflow->sign($serviceOrder,$data,$request->user());return response()->json(['data'=>$this->detail($serviceOrder->fresh())]); }
    public function close(Request $request, ServiceOrder $serviceOrder): JsonResponse { $this->allow($request->user(),'service_orders.close');return response()->json(['data'=>$this->detail($this->workflow->close($serviceOrder,$request->user()))]); }
    public function events(Request $request, ServiceOrder $serviceOrder): JsonResponse { $this->access($request->user(),$serviceOrder);return response()->json(['data'=>$serviceOrder->events()->with('actor:id,name')->latest('id')->get()]); }
    public function pdf(Request $request, ServiceOrder $serviceOrder) { $this->access($request->user(),$serviceOrder);abort_unless($serviceOrder->closed_pdf_path && Storage::disk('local')->exists($serviceOrder->closed_pdf_path),404);return Storage::disk('local')->download($serviceOrder->closed_pdf_path,$serviceOrder->number.'.pdf',['Content-Type'=>'application/pdf']); }
    public function evidenceFile(Request $request, ServiceOrder $serviceOrder, int $evidence) { $this->access($request->user(),$serviceOrder);$item=$serviceOrder->evidences()->findOrFail($evidence);abort_unless(Storage::disk('local')->exists($item->path),404);return Storage::disk('local')->download($item->path,basename($item->path),['Content-Type'=>$item->mime]); }
    public function shareLink(Request $request, ServiceOrder $serviceOrder): JsonResponse { $this->allow($request->user(),'service_orders.share');abort_unless($serviceOrder->closed(),422,'La orden debe estar cerrada.');return response()->json(['url'=>URL::temporarySignedRoute('service-orders.shared-pdf',now()->addDays(7),['serviceOrder'=>$serviceOrder->id])]); }
    public function sharedPdf(Request $request, ServiceOrder $serviceOrder) { abort_unless($request->hasValidSignature(),403,'Enlace inválido o vencido.');abort_unless($serviceOrder->closed_pdf_path && Storage::disk('local')->exists($serviceOrder->closed_pdf_path),404);return Storage::disk('local')->download($serviceOrder->closed_pdf_path,$serviceOrder->number.'.pdf',['Content-Type'=>'application/pdf','X-Robots-Tag'=>'noindex, nofollow']); }
    public function sendPdf(Request $request, ServiceOrder $serviceOrder): JsonResponse { $this->allow($request->user(),'service_orders.share');$data=$request->validate(['email'=>['required','email','max:190']]);abort_unless($serviceOrder->closed(),422);Mail::raw('Gaspronal comparte la orden de servicio '.$serviceOrder->number."\n\n".$this->shareLink($request,$serviceOrder)->getData()->url,function($mail)use($data,$serviceOrder){$mail->to($data['email'])->subject('Gaspronal · Orden de servicio '.$serviceOrder->number);});$this->workflow->event($serviceOrder,$request->user(),'shared_email',['email'=>$data['email']]);return response()->json(['message'=>'Enlace enviado por correo.']); }
    public function customers(Request $request): JsonResponse { $this->allow($request->user(),'service_orders.view');return response()->json(['data'=>ServiceCustomer::query()->when($request->filled('q'),fn($q)=>$q->where(fn($x)=>$x->where('name','like','%'.$request->string('q').'%')->orWhere('document','like','%'.$request->string('q').'%')->orWhere('email','like','%'.$request->string('q').'%')))->orderBy('name')->limit(30)->get()]); }
    public function storeCustomer(Request $request): JsonResponse { $this->allow($request->user(),'service_orders.create');$data=$request->validate(['name'=>['required','string','max:190'],'document'=>['nullable','string','max:80'],'email'=>['nullable','email','max:190'],'phone'=>['nullable','string','max:40'],'whatsapp'=>['nullable','string','max:40'],'addresses'=>['nullable','array'],'reference'=>['nullable','string','max:255'],'commercial_lead_id'=>['nullable','integer',Rule::exists('commercial_leads','id')],'user_id'=>['nullable','integer',Rule::exists('users','id')]]);if(!empty($data['user_id'])){ $user=User::findOrFail($data['user_id']);$user->assignRole(Role::findOrCreate('cliente','api')); }$existing=!empty($data['document'])?ServiceCustomer::query()->where('document',$data['document'])->first():null;$customer=$existing?tap($existing)->update($data):ServiceCustomer::query()->create($data);return response()->json(['data'=>$customer->fresh()],$existing?200:201); }
    public function technicians(Request $request): JsonResponse { $this->allow($request->user(),'service_orders.assign');return response()->json(['data'=>User::query()->whereDoesntHave('roles',fn($q)=>$q->where('name','cliente'))->orderBy('name')->get(['id','name','email','whatsapp'])]); }
    public function myOrders(Request $request): JsonResponse { $user=$request->user();abort_unless($user->hasRole('cliente'),403);$customer=$user->serviceCustomer;return response()->json(['data'=>$customer?->orders()->where('status',ServiceOrderStatus::Closed->value)->with('customer:id,name')->latest()->get()??[]]); }
    public function myAssigned(Request $request): JsonResponse { return response()->json(['data'=>ServiceOrder::query()->with(['customer','assignments.user:id,name,email'])->whereHas('assignments',fn($q)=>$q->where('user_id',$request->user()->id))->where('status', '!=', ServiceOrderStatus::Closed->value)->latest()->get()]); }
    private function detail(ServiceOrder $order):ServiceOrder{return $order->load(['customer','commercialQuote:id,number,status','assignments.user:id,name,email,whatsapp','activities.user:id,name','equipments','materials','evidences.uploader:id,name','signatures.user:id,name','events.actor:id,name']);}
    private function allow(User $user,string $permission):void{abort_unless($user->getAllPermissions()->contains('name',$permission),403);}
    private function access(User $user,ServiceOrder $order):void{if($user->getAllPermissions()->whereIn('name',['service_orders.view','service_orders.manage'])->isNotEmpty())return;if($user->hasRole('cliente')&&$order->closed()&&$order->customer->user_id===$user->id)return;if($order->assignments()->where('user_id',$user->id)->exists())return;abort(403);}
    private function assertTechnician(User $user,ServiceOrder $order):void{abort_unless($user->getAllPermissions()->contains('name','service_orders.manage')||$order->assignments()->where('user_id',$user->id)->exists(),403);}
}
