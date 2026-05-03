# Noticing changes to your VCL? The event log
# (https://docs.fastly.com/en/guides/reviewing-service-activity-with-the-event-log)
# in the web interface shows changes to your service's configurations and the
# change log on developer.fastly.com (https://developer.fastly.com/reference/changes/vcl/)
# provides info on changes to the Fastly-provided VCL itself.

pragma optional_param geoip_opt_in true;
pragma optional_param ratelimit_opt_in true;
pragma optional_param max_ratelimit_ratecounters 5;
pragma optional_param max_ratelimit_penaltyboxes 5;
pragma optional_param max_ratelimit_entries 200000;
pragma optional_param max_object_size 20971520;
pragma optional_param smiss_max_object_size 20971520;
pragma optional_param fetchless_purge_all 1;
pragma optional_param chash_randomize_on_pass true;
pragma optional_param default_ssl_check_cert 1;
pragma optional_param max_backends 100;
pragma optional_param customer_id "6o6FWL9oIbxrQxSc9YFoxO";
C!
W!
# Backends

backend F_AWS_nginx_makers_26 {
    .always_use_host_header = true;
    .between_bytes_timeout = 10s;
    .connect_timeout = 1s;
    .first_byte_timeout = 15s;
    .host = "3.120.234.202";
    .host_header = "makers21.orbs.com";
    .max_connections = 200;
    .port = "80";
    .share_key = "7j8mbPKBkaS7kj9P4b042t";



}
















sub vcl_recv {
#--FASTLY RECV BEGIN
  if (req.restarts == 0) {
    if (!req.http.X-Timer) {
      set req.http.X-Timer = "S" time.start.sec "." time.start.usec_frac;
    }
    set req.http.X-Timer = req.http.X-Timer ",VS0";
  }



  declare local var.fastly_req_do_shield BOOL;
  set var.fastly_req_do_shield = (req.restarts == 0);



  # default conditions
  set req.backend = F_AWS_nginx_makers_26;


    # end default conditions








#--FASTLY RECV END



    if (req.request != "HEAD" && req.request != "GET" && req.request != "FASTLYPURGE") {
      return(pass);
    }


    return(lookup);
}


sub vcl_fetch {
  declare local var.fastly_disable_restart_on_error BOOL;



#--FASTLY FETCH BEGIN



# record which cache ran vcl_fetch for this object and when
  set beresp.http.Fastly-Debug-Path = "(F " server.identity " " now.sec ") " if(beresp.http.Fastly-Debug-Path, beresp.http.Fastly-Debug-Path, "");

# generic mechanism to vary on something
  if (req.http.Fastly-Vary-String) {
    if (beresp.http.Vary) {
      set beresp.http.Vary = "Fastly-Vary-String, "  beresp.http.Vary;
    } else {
      set beresp.http.Vary = "Fastly-Vary-String, ";
    }
  }



#--FASTLY FETCH END



  if (!var.fastly_disable_restart_on_error) {
    if ((beresp.status == 500 || beresp.status == 503) && req.restarts < 1 && (req.request == "GET" || req.request == "HEAD")) {
      restart;
    }
  }

  if(req.restarts > 0 ) {
    set beresp.http.Fastly-Restarts = req.restarts;
  }

  if (beresp.http.Set-Cookie) {
    set req.http.Fastly-Cachetype = "SETCOOKIE";
    return (pass);
  }

  if (beresp.http.Cache-Control ~ "private") {
    set req.http.Fastly-Cachetype = "PRIVATE";
    return (pass);
  }

  if (beresp.status == 500 || beresp.status == 503) {
    set req.http.Fastly-Cachetype = "ERROR";
    set beresp.ttl = 1s;
    set beresp.grace = 5s;
    return (deliver);
  }


  if (beresp.http.Expires || beresp.http.Surrogate-Control ~ "max-age" || beresp.http.Cache-Control ~"(?:s-maxage|max-age)") {
    # keep the ttl here
  } else {
        # apply the default ttl
    set beresp.ttl = 60s;

  }

  return(deliver);
}

sub vcl_hit {
#--FASTLY HIT BEGIN

# we cannot reach obj.ttl and obj.grace in deliver, save them when we can in vcl_hit
  set req.http.Fastly-Tmp-Obj-TTL = obj.ttl;
  set req.http.Fastly-Tmp-Obj-Grace = obj.grace;

  {
    set req.http.Fastly-Cachetype = "HIT";
  }

#--FASTLY HIT END
  if (!obj.cacheable) {
    return(pass);
  }
  return(deliver);
}

sub vcl_miss {
#--FASTLY MISS BEGIN


# this is not a hit after all, clean up these set in vcl_hit
  unset req.http.Fastly-Tmp-Obj-TTL;
  unset req.http.Fastly-Tmp-Obj-Grace;

  {
    if (req.http.Fastly-Check-SHA1) {
       error 550 "Doesnt exist";
    }

#--FASTLY BEREQ BEGIN
    {
      {
        if (req.http.Fastly-FF) {
          set bereq.http.Fastly-Client = "1";
        }
      }
      {
        # do not send this to the backend
        unset bereq.http.Fastly-Original-Cookie;
        unset bereq.http.Fastly-Original-URL;
        unset bereq.http.Fastly-Vary-String;
        unset bereq.http.X-Varnish-Client;
      }
      if (req.http.Fastly-Temp-XFF) {
         if (req.http.Fastly-Temp-XFF == "") {
           unset bereq.http.X-Forwarded-For;
         } else {
           set bereq.http.X-Forwarded-For = req.http.Fastly-Temp-XFF;
         }
         # unset bereq.http.Fastly-Temp-XFF;
      }
    }
#--FASTLY BEREQ END


 #;

    set req.http.Fastly-Cachetype = "MISS";

  }

#--FASTLY MISS END
  return(fetch);
}

sub vcl_deliver {


#--FASTLY DELIVER BEGIN

# record the journey of the object, expose it only if req.http.Fastly-Debug.
  if (req.http.Fastly-Debug || req.http.Fastly-FF) {
    set resp.http.Fastly-Debug-Path = "(D " server.identity " " now.sec ") "
       if(resp.http.Fastly-Debug-Path, resp.http.Fastly-Debug-Path, "");

    set resp.http.Fastly-Debug-TTL = if(obj.hits > 0, "(H ", "(M ")
       server.identity
       if(req.http.Fastly-Tmp-Obj-TTL && req.http.Fastly-Tmp-Obj-Grace, " " req.http.Fastly-Tmp-Obj-TTL " " req.http.Fastly-Tmp-Obj-Grace " ", " - - ")
       if(resp.http.Age, resp.http.Age, "-")
       ") "
       if(resp.http.Fastly-Debug-TTL, resp.http.Fastly-Debug-TTL, "");

    set resp.http.Fastly-Debug-Digest = digest.hash_sha256(req.digest);
  } else {
    unset resp.http.Fastly-Debug-Path;
    unset resp.http.Fastly-Debug-TTL;
    unset resp.http.Fastly-Debug-Digest;
  }

  # add or append X-Served-By/X-Cache(-Hits)
  {

    if(!resp.http.X-Served-By) {
      set resp.http.X-Served-By  = server.identity;
    } else {
      set resp.http.X-Served-By = resp.http.X-Served-By ", " server.identity;
    }

    set resp.http.X-Cache = if(resp.http.X-Cache, resp.http.X-Cache ", ","") if(fastly_info.state ~ "HIT(?:-|\z)", "HIT", "MISS");

    if(!resp.http.X-Cache-Hits) {
      set resp.http.X-Cache-Hits = obj.hits;
    } else {
      set resp.http.X-Cache-Hits = resp.http.X-Cache-Hits ", " obj.hits;
    }

  }

  if (req.http.X-Timer) {
    set resp.http.X-Timer = req.http.X-Timer ",VE" time.elapsed.msec;
  }

  # VARY FIXUP
  {
    # remove before sending to client
    set resp.http.Vary = regsub(resp.http.Vary, "Fastly-Vary-String, ", "");
    if (resp.http.Vary ~ "^\s*$") {
      unset resp.http.Vary;
    }
  }
  unset resp.http.X-Varnish;


  # Pop the surrogate headers into the request object so we can reference them later
  set req.http.Surrogate-Key = resp.http.Surrogate-Key;
  set req.http.Surrogate-Control = resp.http.Surrogate-Control;

  # If we are not forwarding or debugging unset the surrogate headers so they are not present in the response
  if (!req.http.Fastly-FF && !req.http.Fastly-Debug) {
    unset resp.http.Surrogate-Key;
    unset resp.http.Surrogate-Control;
  }

  if(resp.status == 550) {
    return(deliver);
  }
  #default response conditions






#--FASTLY DELIVER END
  return(deliver);
}

sub vcl_error {
#--FASTLY ERROR BEGIN


  if (obj.status == 801) {
     set obj.status = 301;
     set obj.response = "Moved Permanently";
     set obj.http.Location = "https://" req.http.host req.url;
     synthetic {""};
     return (deliver);
  }




  if (req.http.Fastly-Restart-On-Error) {
    if (obj.status == 503 && req.restarts == 0) {
      restart;
    }
  }

  {
    if (obj.status == 550) {
      return(deliver);
    }
  }
#--FASTLY ERROR END



}

sub vcl_pipe {
#--FASTLY PIPE BEGIN
  {


#--FASTLY BEREQ BEGIN
    {
      {
        if (req.http.Fastly-FF) {
          set bereq.http.Fastly-Client = "1";
        }
      }
      {
        # do not send this to the backend
        unset bereq.http.Fastly-Original-Cookie;
        unset bereq.http.Fastly-Original-URL;
        unset bereq.http.Fastly-Vary-String;
        unset bereq.http.X-Varnish-Client;
      }
      if (req.http.Fastly-Temp-XFF) {
         if (req.http.Fastly-Temp-XFF == "") {
           unset bereq.http.X-Forwarded-For;
         } else {
           set bereq.http.X-Forwarded-For = req.http.Fastly-Temp-XFF;
         }
         # unset bereq.http.Fastly-Temp-XFF;
      }
    }
#--FASTLY BEREQ END


    #;
    set req.http.Fastly-Cachetype = "PIPE";
    set bereq.http.connection = "close";
  }
#--FASTLY PIPE END

}

sub vcl_pass {
#--FASTLY PASS BEGIN


  {

#--FASTLY BEREQ BEGIN
    {
      {
        if (req.http.Fastly-FF) {
          set bereq.http.Fastly-Client = "1";
        }
      }
      {
        # do not send this to the backend
        unset bereq.http.Fastly-Original-Cookie;
        unset bereq.http.Fastly-Original-URL;
        unset bereq.http.Fastly-Vary-String;
        unset bereq.http.X-Varnish-Client;
      }
      if (req.http.Fastly-Temp-XFF) {
         if (req.http.Fastly-Temp-XFF == "") {
           unset bereq.http.X-Forwarded-For;
         } else {
           set bereq.http.X-Forwarded-For = req.http.Fastly-Temp-XFF;
         }
         # unset bereq.http.Fastly-Temp-XFF;
      }
    }
#--FASTLY BEREQ END


 #;
    set req.http.Fastly-Cachetype = "PASS";
  }

#--FASTLY PASS END

}

sub vcl_log {
#--FASTLY LOG BEGIN

  # default response conditions

  # elasticsearch Log_streaming_to_Elasticsearch
  log {"syslog "} req.service_id {" Log streaming to Elasticsearch :: "} {"{     "timestamp": ""} strftime({"%Y-%m-%dT%H:%M:%S%z"}, time.start) {"",     "client_ip": ""} req.http.Fastly-Client-IP {"",     "geo_country": ""} client.geo.country_name {"",     "geo_city": ""} client.geo.city {"",     "host": ""} if(req.http.Fastly-Orig-Host, req.http.Fastly-Orig-Host, req.http.Host) {"",     "url": ""} json.escape(req.url) {"",     "request_method": ""} json.escape(req.method) {"",     "request_protocol": ""} json.escape(req.proto) {"",     "request_referer": ""} json.escape(req.http.referer) {"",     "request_user_agent": ""} json.escape(req.http.User-Agent) {"",     "response_state": ""} json.escape(fastly_info.state) {"",     "response_status": "} resp.status {",     "response_reason": "} if(resp.response, "%22"+json.escape(resp.response)+"%22", "null") {",     "response_body_size": "} resp.body_bytes_written {",     "fastly_server": ""} json.escape(server.identity) {"",     "fastly_is_edge": "} if(fastly.ff.visits_this_service == 0, "true", "false") "   }";



#--FASTLY LOG END

}

sub vcl_hash {

#--FASTLY HASH BEGIN



  #if unspecified fall back to normal
  {


    set req.hash += req.url;
    set req.hash += req.http.host;
    set req.hash += req.vcl.generation;
    return (hash);
  }
#--FASTLY HASH END


}

