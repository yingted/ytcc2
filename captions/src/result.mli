(**
   Copyright 2020 Google LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*)

type ('ok, 'err) t = ('ok, 'err) result
val is_ok: ('ok, 'err) t -> bool
val ok: ('ok, 'err) t -> 'ok option
val ok_exn: ('ok, 'err) t -> 'ok
val error: ('ok, 'err) t -> 'err option
val return: 'a -> ('a, 'err) t
val bind: ('a, 'err) t -> ('a -> ('b, 'err) t) -> ('b, 'err) t
val map: ('a, 'err) t -> f:('a -> 'b) -> ('b, 'err) t
val value: ('a, 'e) result -> default:'a -> 'a
